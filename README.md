# Nuclear Atlas

[![MIT License](https://img.shields.io/badge/license-MIT-2f2a21.svg)](LICENSE)

Separate announced from binding. Every nuclear × large-load deal, its structure, its contractual weight, and what changed, in one free place.

The dataset is the product. The site is a static, filterable viewer with per-fact sourcing, a published bindingness rubric, open downloads, and a permanent changelog. Its credibility layer checks approved public sources daily while preserving source-native dates, failures, conflicts, and corrections.

## Screenshot

![Tracker screenshot placeholder](docs/screenshot-placeholder.svg)

## Quickstart

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. To validate and export the production site:

```bash
npm test
npm run validate:data
npm run validate:credibility
npm run build
```

The static export is written to `out/`.

## Local collection storage

Run `npm run db:seed` to archive the existing release in a local SQLite database, then `npm run db:status` to inspect it. No database server is required. See [the database schema](docs/database-schema.md) for tables and relationships, and [the local store guide](docs/local-data-store.md) for source imports, queries, exports, and backups. The existing workbook and static publication workflow remain in place.

## Data

`data/deals.json` contains one object per deal. The schema is published at `data/schema.json` and enforced in CI. Core fields cover:

- named parties and buyer type
- technology and contract structure
- firm MW and optioned MW as separate values
- bindingness tier and evidence
- announcement, target, and status-change dates
- location and grid region
- sources with a statement of what each source supports
- analyst note, verification flag, and last-verified date

Generated downloads are available as JSON and CSV under `public/data/` after running the build.

## Credibility layer

`data/credibility/` contains the source registry, retrieval-receipt schema, append-only evidence ledger, five-project proof cohort, and proof-review log. The automated pipeline:

- polls only sources explicitly marked `approved_automated`
- records changed, unchanged, failed, and blocked checks
- uses raw and canonical hashes to avoid false changes from volatile API metadata
- blocks incomplete pagination, unexpected empty results, schema drift, and unresolved reviewed conflicts
- retains last-known-good facts during source failures
- excludes observed and conflicting evidence from public downloads

Run a read-only live probe with `npm run credibility:probe`. Read [the credibility operator guide](docs/credibility.md) before approving a source or evidence event.

Generated public outputs include `source-registry.json`, `source-probes.json`, `source-status.json`, `evidence-events.json`, and `credibility-proof.json`. The proof gate starts closed and requires 14 complete daily runs plus a 20-claim audit before dashboard expansion.

## Bindingness

The seven-tier rubric runs from B0, unconfirmed reporting, through B5, operating under the deal. BX preserves dead, lapsed, and superseded records. Read the complete [methodology and rubric](https://nuclearatlas.lucaschatham.com/about/).

## Contribute a correction

Open a [GitHub issue](https://github.com/lucaschatham/nuclear-atlas/issues) with the deal id, proposed correction, and a primary source. For direct additions, follow [CONTRIBUTING.md](CONTRIBUTING.md) and include a changelog entry.

## License

Code and data are available under the [MIT License](LICENSE). Informational only, not investment advice.
