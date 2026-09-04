from contextlib import closing
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('local_store', ROOT / 'scripts/local-store.py')
store = importlib.util.module_from_spec(spec)
spec.loader.exec_module(store)


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.db = store.open_store(self.root)
        self.addCleanup(self.db.close)

    def sample(self, rows):
        file = self.root / 'input.json'
        file.write_text(json.dumps(rows))
        return file

    def ingest(self, file, **kwargs):
        return store.import_json(self.db, self.root, file, source_id='nrc-test',
                                 source_url='https://www.nrc.gov/example', scope='Test fixture', **kwargs)

    def test_release_round_trip_and_idempotency(self):
        file = ROOT / 'data/atlas-release.json'
        first = store.import_release(self.db, self.root, file)
        second = store.import_release(self.db, self.root, file)
        self.assertEqual(first, second)
        self.assertEqual(self.db.execute('SELECT count(*) FROM collections').fetchone()[0], 1)
        self.assertEqual(self.db.execute('SELECT count(*) FROM records').fetchone()[0], 247)
        self.assertEqual(self.db.execute('SELECT count(*) FROM citations').fetchone()[0], 549)
        output = store.export_original(self.db, self.root, first)
        self.assertEqual(output.read_bytes(), file.read_bytes())
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_changed_rows_preserve_history_nulls_and_native_dates(self):
        first = self.ingest(self.sample([{'id': '001', 'capacity': None, 'date': '2025Q1'}]))
        second = self.ingest(self.sample([{'id': '001', 'capacity': 0, 'date': '2025Q1'}]))
        self.assertNotEqual(first, second)
        rows = self.db.execute('SELECT payload_json FROM records ORDER BY rowid').fetchall()
        self.assertIsNone(json.loads(rows[0][0])['capacity'])
        self.assertEqual(json.loads(rows[1][0])['capacity'], 0)
        self.assertEqual(json.loads(rows[0][0])['date'], '2025Q1')
        meta = json.loads(self.db.execute('SELECT metadata_json FROM collections LIMIT 1').fetchone()[0])
        self.assertEqual(meta['review_status'], 'observed')
        self.assertIsNone(meta['retrieved_at_utc'])
        self.assertEqual(meta['completeness'], 'unknown')

    def test_invalid_batch_does_not_partially_import(self):
        for rows in ([{'id': 'a'}, {'id': 'a'}], [{'id': 'a'}, {'value': 3}], [], [{'id': True}]):
            with self.assertRaises(ValueError):
                self.ingest(self.sample(rows))
        self.assertEqual(self.db.execute('SELECT count(*) FROM collections').fetchone()[0], 0)

    def test_different_retrievals_preserve_provenance(self):
        file = self.sample([{'id': 'a'}])
        first = self.ingest(file, retrieved_at='2026-09-04T10:00:00Z')
        second = self.ingest(file, retrieved_at='2026-09-05T10:00:00Z')
        self.assertNotEqual(first, second)
        with self.assertRaises(ValueError):
            self.ingest(file, retrieved_at='2026-09-04')

    def test_broken_release_reference_rejected(self):
        release = json.loads((ROOT / 'data/atlas-release.json').read_text())
        release['stages']['operations']['records'][0]['citations'][0]['sourceId'] = 'missing'
        file = self.root / 'broken.json'
        file.write_text(json.dumps(release))
        with self.assertRaises(ValueError):
            store.import_release(self.db, self.root, file)
        self.assertEqual(self.db.execute('SELECT count(*) FROM records').fetchone()[0], 0)

    def test_backup_restores_database_and_detects_changed_snapshot(self):
        collection = self.ingest(self.sample([{'id': 'a'}]))
        backup = store.backup_store(self.db, self.root)
        with closing(sqlite3.connect(backup)) as restored:
            self.assertEqual(restored.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
            self.assertEqual(restored.execute('SELECT count(*) FROM records').fetchone()[0], 1)
        row = self.db.execute('SELECT snapshot_path FROM collections WHERE id=?', (collection,)).fetchone()
        (self.root / row[0]).write_text('corrupt')
        with self.assertRaises(ValueError):
            store.export_original(self.db, self.root, collection)


if __name__ == '__main__':
    unittest.main()
