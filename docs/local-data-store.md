# Local SQLite data store

Nuclear Atlas stores collected data in `.local-data/nuclear-atlas.sqlite` on this computer. Python 3 and its built-in `sqlite3` module are the only requirements. No service, port, account, ORM, or database package is needed.

The SQLite archive is a collection workspace. Google Sheets and the reviewed workbook remain the publication authoring layer. The website still reads generated static JSON. These commands never approve a release, overwrite production data, or fetch a public source.

See the [database schema](database-schema.md) for table definitions, relationships, keys, metadata fields, and evidence rules.

## Start and inspect

From the repository directory:

```sh
npm run db:init
npm run db:seed
npm run db:status
```

`db:seed` archives the existing `data/atlas-release.json`, including source records, lifecycle records, citations, and the exact original JSON bytes. Repeating an identical import reuses the collection. A different snapshot creates a new collection without deleting the old one. Imports create a dated SQLite backup after committing.

The initial release contains 247 lifecycle records, 44 sources, and 549 citations. Its August 26, 2026 dates remain unchanged. The separate `imported_at_utc` field records when this computer stored the collection; it does not claim a fresh source retrieval.

## Files

```text
.local-data/
  nuclear-atlas.sqlite       Structured records and provenance
  snapshots/<sha256>.json    Exact imported JSON, shared across collections
  exports/<sha256>.json      Copies of original snapshots for local inspection
  backups/<dated>.sqlite    Consistent database backups
```

This entire directory is ignored by Git and sits outside `public/`. Do not put the database in a shared network folder for simultaneous editing. Use a copy made by the backup command when moving an active database.

## Import a source snapshot

The first importer accepts a JSON array of objects with unique, nonempty string identifiers. Preserve original fields and null values. Use a documented source identifier; do not generate identities with fuzzy matching. Source-specific adapters can prepare this array later. This command reads the file locally; it does not verify external source access or completeness.

```sh
npm run db -- import-json /absolute/path/records.json \
  --source-id nrc-example \
  --source-url https://www.nrc.gov/example \
  --scope 'Describe geographic coverage, date filters, and pagination' \
  --id-field id \
  --source-date 2025Q1 \
  --retrieved-at 2026-09-04T18:00:00Z \
  --completeness partial
```

Replace the example values with actual provenance. Omit `--source-date` and `--retrieved-at` when unknown. Completeness defaults to `unknown`; use `complete` only after verifying the stated scope and pagination. Do not store API keys in URLs, scope text, or source files.

New source collections are always marked `observed`, even if a source payload contains its own approval field. An empty array, duplicate identifiers, malformed rows, or invalid retrieval timestamp fails the import. Failed imports do not replace prior records. Exact repeated data and provenance reuse the same collection; a changed retrieval timestamp preserves a separate collection even if its content is unchanged.

Imports currently read each JSON file into memory. PDFs, HTML, CSV, automated fetching, and very large streaming imports are future adapter work. No scheduler runs in the background.

## Query

Any SQLite client can open the database. If the `sqlite3` CLI is installed:

```sh
sqlite3 -readonly .local-data/nuclear-atlas.sqlite
```

```sql
SELECT stage, count(*) FROM records GROUP BY stage;
SELECT id, kind, imported_at_utc, record_count FROM collections;
SELECT record_id, payload_json FROM records WHERE stage = 'operations' LIMIT 3;
SELECT source_id, payload_json FROM sources;
```

Rows are scoped to a collection. Counts across several collections include history, not distinct facilities. Filter on `collection_id` to examine one snapshot. Source definitions and citations are versioned alongside their collection so later source metadata cannot rewrite earlier evidence. Original source fields stay in `payload_json`.

## Export

Get a collection ID from `db:status`, then run:

```sh
npm run db -- export COLLECTION_ID
```

This verifies the archived SHA-256 and copies the original file to local `exports/`. It is a byte-for-byte snapshot export, not a transformation of edited database rows or a new public release. Source JSON stays unreviewed. Continue using the existing workbook import, validation, and explicit approval workflow for publication.

## Back up and restore

```sh
npm run db:backup
```

The command uses SQLite's backup API and checks backup integrity. The `.sqlite` backup contains the database, including structured payloads; raw snapshot files remain in `snapshots/`. Keep both. A backup on the same disk protects against some editing mistakes, but not loss of the computer. Copy a completed backup and the snapshot folder to a second device or storage service. No external backup destination has been configured.

To restore, stop local import commands, preserve the existing database, and copy a completed backup to `.local-data/nuclear-atlas.sqlite`. Restore `snapshots/` beside it. Run `npm run db:status` and export a known collection to verify the restored evidence. Never restore over a database another process is writing.

Backups are not deleted automatically. Review older copies as storage grows.

For an isolated test or another storage location, put the directory option before the command:

```sh
npm run db -- --directory /absolute/path/to/local-store init
```
