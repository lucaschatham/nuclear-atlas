#!/usr/bin/env python3
"""Local, append-only collection archive. Standard library only; no network calls."""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import uuid
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DIRECTORY = ROOT / '.local-data'
SCHEMA = '''
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK(kind IN ('atlas_release', 'source_json')),
    imported_at_utc TEXT NOT NULL,
    snapshot_sha256 TEXT NOT NULL,
    snapshot_path TEXT NOT NULL,
    record_count INTEGER NOT NULL CHECK(record_count > 0),
    metadata_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sources (
    collection_id TEXT NOT NULL REFERENCES collections(id),
    source_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    PRIMARY KEY(collection_id, source_id)
);
CREATE TABLE IF NOT EXISTS records (
    collection_id TEXT NOT NULL REFERENCES collections(id),
    record_id TEXT NOT NULL,
    stage TEXT,
    payload_json TEXT NOT NULL,
    PRIMARY KEY(collection_id, record_id)
);
CREATE TABLE IF NOT EXISTS citations (
    collection_id TEXT NOT NULL,
    citation_id TEXT NOT NULL,
    record_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    PRIMARY KEY(collection_id, citation_id),
    FOREIGN KEY(collection_id, record_id) REFERENCES records(collection_id, record_id),
    FOREIGN KEY(collection_id, source_id) REFERENCES sources(collection_id, source_id)
);
CREATE INDEX IF NOT EXISTS records_by_id ON records(record_id);
CREATE INDEX IF NOT EXISTS records_by_stage ON records(stage);
CREATE INDEX IF NOT EXISTS citations_by_source ON citations(source_id);
PRAGMA user_version = 1;
'''


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False)


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec='microseconds').replace('+00:00', 'Z')


def open_store(directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(directory / 'nuclear-atlas.sqlite', timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA foreign_keys = ON')
    version = connection.execute('PRAGMA user_version').fetchone()[0]
    if version not in (0, 1):
        connection.close()
        raise ValueError(f'Unsupported local store schema version: {version}')
    connection.executescript(SCHEMA)
    return connection


def require_text(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'{label} must be a nonempty string')
    return value


def unique_ids(items, field, label):
    if not isinstance(items, list):
        raise ValueError(f'{label} must be an array')
    ids = set()
    for item in items:
        if not isinstance(item, dict):
            raise ValueError(f'{label} must contain objects')
        identifier = require_text(item.get(field), f'{label}.{field}')
        if identifier in ids:
            raise ValueError(f'Duplicate {label} identifier: {identifier}')
        ids.add(identifier)
    return ids


def read_json(file):
    raw = Path(file).read_bytes()
    value = json.loads(raw)
    encode(value)  # Reject non-standard NaN/Infinity before storing any rows.
    return raw, value


def persist(connection, directory, raw, kind, metadata, sources, records, citations):
    if not records:
        raise ValueError('Empty collections are not imported; they must not replace known records')
    digest = hashlib.sha256(raw).hexdigest()
    collection_id = hashlib.sha256(encode([kind, digest, metadata]).encode()).hexdigest()
    snapshot_path = f'snapshots/{digest}.json'
    snapshot = Path(directory) / snapshot_path
    snapshot.parent.mkdir(parents=True, exist_ok=True)
    # Identical imports reuse one immutable raw file. Never replace altered evidence.
    try:
        with snapshot.open('xb') as output:
            output.write(raw)
    except FileExistsError:
        if snapshot.read_bytes() != raw:
            raise ValueError(f'Snapshot checksum mismatch: {snapshot}')
    with connection:
        inserted = connection.execute(
            'INSERT OR IGNORE INTO collections VALUES (?, ?, ?, ?, ?, ?, ?)',
            (collection_id, kind, utc_now(), digest, snapshot_path, len(records), encode(metadata)),
        ).rowcount
        if inserted:
            connection.executemany('INSERT INTO sources VALUES (?, ?, ?)',
                                   [(collection_id, item['id'], encode(item)) for item in sources])
            connection.executemany('INSERT INTO records VALUES (?, ?, ?, ?)',
                                   [(collection_id, identifier, stage, encode(item)) for identifier, stage, item in records])
            connection.executemany('INSERT INTO citations VALUES (?, ?, ?, ?, ?)',
                                   [(collection_id, item['id'], record_id, item['sourceId'], encode(item))
                                    for record_id, item in citations])
    return collection_id


def import_release(connection, directory, file):
    raw, release = read_json(file)
    if not isinstance(release, dict) or release.get('schemaVersion') != 2:
        raise ValueError('Expected an Atlas release with schemaVersion 2')
    require_text(release.get('releaseId'), 'releaseId')
    sources = release.get('sources')
    source_ids = unique_ids(sources, 'id', 'sources')
    if release.get('sourceCount') != len(sources):
        raise ValueError('Release sourceCount does not match sources')
    stages = release.get('stages')
    if not isinstance(stages, dict) or not stages:
        raise ValueError('Release stages are missing')
    records, citations = [], []
    for stage, bundle in stages.items():
        if not isinstance(bundle, dict):
            raise ValueError('Each stage must be an object')
        stage_records = bundle.get('records')
        unique_ids(stage_records, 'id', 'records')
        if bundle.get('recordCount') != len(stage_records):
            raise ValueError(f'Record count does not match stage {stage}')
        for record in stage_records:
            if record.get('stage') != stage:
                raise ValueError('Record stage does not match its bundle')
            refs = record.get('sourceIds')
            if not isinstance(refs, list) or any(not isinstance(ref, str) or ref not in source_ids for ref in refs):
                raise ValueError('Record references an unknown source')
            record_citations = record.get('citations')
            unique_ids(record_citations, 'id', 'citations')
            for citation in record_citations:
                if citation.get('sourceId') not in refs:
                    raise ValueError('Citation references an unknown record source')
                citations.append((record['id'], citation))
            records.append((record['id'], stage, record))
    unique_ids([item for _, _, item in records], 'id', 'records')
    unique_ids([item for _, item in citations], 'id', 'citations')
    metadata = {key: value for key, value in release.items() if key not in ('sources', 'stages')}
    # Archiving preserves the supplied review state; it does not approve a release.
    return persist(connection, directory, raw, 'atlas_release', metadata, sources, records, citations)


def import_json(connection, directory, file, *, source_id, source_url, scope,
                id_field='id', source_date=None, retrieved_at=None, completeness='unknown'):
    require_text(source_id, 'source_id')
    require_text(scope, 'scope')
    require_text(id_field, 'id_field')
    parsed = urlparse(source_url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('source_url must be an HTTPS source URL without embedded credentials')
    if completeness not in ('unknown', 'partial', 'complete'):
        raise ValueError('completeness must be unknown, partial, or complete')
    if retrieved_at is not None:
        try:
            if not retrieved_at.endswith('Z') or 'T' not in retrieved_at:
                raise ValueError()
            datetime.fromisoformat(retrieved_at.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            raise ValueError('retrieved_at must be a UTC instant ending in Z') from None
    raw, rows = read_json(file)
    unique_ids(rows, id_field, 'records')
    metadata = dict(source_id=source_id, source_url=source_url, scope=scope, id_field=id_field,
                    source_date_original=source_date, retrieved_at_utc=retrieved_at,
                    completeness=completeness, review_status='observed')
    sources = [dict(id=source_id, url=source_url)]
    return persist(connection, directory, raw, 'source_json', metadata, sources,
                   [(row[id_field], None, row) for row in rows], [])


def export_original(connection, directory, collection_id):
    row = connection.execute('SELECT * FROM collections WHERE id=?', (collection_id,)).fetchone()
    if row is None:
        raise ValueError('Unknown collection ID; use the status command to list collections')
    # Derive paths from the verified digest rather than accepting a stored arbitrary path.
    digest = row['snapshot_sha256']
    if len(digest) != 64 or any(char not in '0123456789abcdef' for char in digest):
        raise ValueError('Invalid snapshot hash')
    raw = (Path(directory) / 'snapshots' / f'{digest}.json').read_bytes()
    if hashlib.sha256(raw).hexdigest() != digest:
        raise ValueError('Snapshot checksum mismatch; restore the original snapshot from backup')
    exports = Path(directory) / 'exports'
    exports.mkdir(parents=True, exist_ok=True)
    output = exports / f'{digest}.json'
    output.write_bytes(raw)
    return output


def backup_store(connection, directory):
    backups = Path(directory) / 'backups'
    backups.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    output = backups / f'nuclear-atlas-{timestamp}-{uuid.uuid4().hex[:8]}.sqlite'
    with closing(sqlite3.connect(output)) as destination:
        connection.backup(destination)
        if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('Backup integrity check failed')
    return output


def status(connection, directory):
    return {
        'database': str(Path(directory) / 'nuclear-atlas.sqlite'),
        'integrity': connection.execute('PRAGMA integrity_check').fetchone()[0],
        'counts': {table: connection.execute(f'SELECT count(*) FROM {table}').fetchone()[0]
                   for table in ('collections', 'sources', 'records', 'citations')},
        'collections': [dict(row) for row in connection.execute(
            'SELECT id, kind, imported_at_utc, record_count, metadata_json FROM collections ORDER BY rowid')],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=DEFAULT_DIRECTORY, help='Local storage directory')
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('init')
    commands.add_parser('status')
    commands.add_parser('backup')
    release = commands.add_parser('import-release', help='Archive an existing release; does not publish')
    release.add_argument('file', type=Path, nargs='?', default=ROOT / 'data/atlas-release.json')
    ingest = commands.add_parser('import-json', help='Archive a JSON array of source records as unreviewed evidence')
    ingest.add_argument('file', type=Path)
    ingest.add_argument('--source-id', required=True)
    ingest.add_argument('--source-url', required=True)
    ingest.add_argument('--scope', required=True, help='Coverage and retrieval filters; do not include credentials')
    ingest.add_argument('--id-field', default='id')
    ingest.add_argument('--source-date', help='Original source date or period, unchanged')
    ingest.add_argument('--retrieved-at', help='Actual source retrieval instant in UTC; omit if unknown')
    ingest.add_argument('--completeness', choices=['unknown', 'partial', 'complete'], default='unknown')
    export = commands.add_parser('export', help='Copy the original snapshot to local exports; never publishes')
    export.add_argument('collection_id')
    args = parser.parse_args()
    directory = args.directory.expanduser().resolve()
    if args.command in ('status', 'backup', 'export') and not (directory / 'nuclear-atlas.sqlite').is_file():
        parser.error('Database does not exist; run init or import-release first')
    try:
        with closing(open_store(directory)) as connection:
            if args.command in ('init', 'status'):
                result = status(connection, directory)
            elif args.command == 'backup':
                result = {'backup': str(backup_store(connection, directory))}
            elif args.command == 'export':
                result = {'export': str(export_original(connection, directory, args.collection_id))}
            else:
                if args.command == 'import-release':
                    collection_id = import_release(connection, directory, args.file)
                else:
                    collection_id = import_json(connection, directory, args.file, source_id=args.source_id,
                                                source_url=args.source_url, scope=args.scope, id_field=args.id_field,
                                                source_date=args.source_date, retrieved_at=args.retrieved_at,
                                                completeness=args.completeness)
                # Backup uses SQLite's online backup API, not a copy of an open DB file.
                result = {'collection_id': collection_id, 'backup': str(backup_store(connection, directory))}
            print(json.dumps(result, indent=2))
    except (ValueError, OSError, sqlite3.Error) as error:
        parser.exit(1, f'Local store error: {error}\n')


if __name__ == '__main__':
    main()
