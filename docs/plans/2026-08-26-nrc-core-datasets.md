# NRC Core Datasets Release Plan

## Objective

Add three frozen, source-cited NRC datasets to the existing Google Sheet and static Nuclear Atlas release:

1. Power Reactors and Power Reactors Formerly Licensed to Operate.
2. Reactor Oversight Process inspection findings and Action Matrix status.
3. Fuel Cycle Facilities.

The release must preserve unknown values, source-native dates, NRC identifiers, location precision, existing public URLs, and the current static build model.

## Premises

- The Google Sheet remains the private authoring database.
- Production reads reviewed JSON and CSV generated from a frozen XLSX snapshot, never Google Sheets at runtime.
- NRC docket numbers and stable NRC facility or unit identifiers form the join spine.
- The Atlas displays NRC safety classifications directly. It does not calculate a composite safety score.
- This is a dated snapshot release. Later NRC changes wait for a later reviewed release.
- Security-related findings or non-public operational detail remain excluded.

## Execution Flow

```text
Official NRC source files and pages
  |-- Power reactor demographics
  |-- Formerly licensed reactor demographics
  |-- Public ROP findings and Action Matrix
  `-- Fuel-cycle facility locator
              |
              v
Freeze source snapshots and record source dates
              |
              v
Normalize NRC identifiers, sites, reactors, lifecycle rows, and citations
              |
              v
Update Google Sheet and frozen XLSX with identical reviewed rows
              |
              v
Validate references, enums, dates, locations, reuse, and citations
              |
              v
Generate static Atlas JSON and CSV
              |
              v
Render reactor, operations/safety, decommissioning, and fuel-supply records
              |
              v
Tests, autoreview, production build, commit, push, smoke test
```

## Data Mapping

### Reactor backbone

- Upsert `SITES` by NRC docket and normalized facility identity.
- Upsert `REACTORS` by stable NRC unit identity.
- Preserve reactor type, model, vendor, capacities, milestone dates, operating status, status date, and authority ID.
- Add or update `OPERATIONS` identity snapshots for operating units.
- Add or update `DECOMMISSIONING` rows for formerly licensed units only where the NRC source states a public strategy or phase.

### Safety oversight

- Publish one reactor-level oversight snapshot, not one row per finding.
- Preserve the latest Action Matrix column, its source-native label, the 2024 public finding and violation count, the greater-than-Green count, and the latest public finding date.
- Retain the 18,240-row frozen findings workbook for a later dedicated findings explorer.
- Never infer safety, risk, security posture, or trend from missing or withheld findings.

### Fuel-cycle facilities

- Upsert `SITES` and `FUEL_SUPPLY` by NRC docket or facility identity.
- Preserve fuel-cycle stage, material or product, public status, docket, location, and source date.
- Leave capacity blank unless the NRC publishes a comparable value and basis.

## Code Changes

- Add deterministic NRC snapshot files under `data/source-snapshots/`.
- Add one idempotent workbook ingestion script that reuses the current release tables and citation model.
- Extend the release mapping only where current record details cannot express reactor or safety fields.
- Add stage-specific labels and filters through the existing workspace, Map, Table, and inspector components.
- Update source inventory and methodology descriptions from the same source registry.

## Verification

- Add fixture tests before ingestion code.
- Prove a second run creates identical normalized IDs, counts, canonical-model hash, and JSON hash. XLSX ZIP metadata may differ.
- Validate duplicate IDs, joins, enums, coordinates, source dates, citations, and reuse status.
- Compare Map and Table record IDs for affected stages.
- Test missing safety data, unknown capacity, country or state precision, and superseded findings.
- Run data validation, credibility validation, unit tests, lint, static build, UI validation, and browser smoke tests.
- Run `autoreview`, verify each finding against code, fix accepted findings, and rerun until clean.

## Release Gate

- The Sheet, XLSX, JSON, and CSV contain the same reviewed records.
- Every published lifecycle record has an approved citation and source locator.
- No composite safety score or inferred fuel capacity appears.
- Existing 17 projects and 80 spent-fuel records retain parity.
- Production deploys only an approved release and passes a smoke test at `nuclearatlas.lucaschatham.com`.

## Not In Scope

- Daily collection or runtime APIs.
- International reactor coverage.
- Private fuel capacity, pricing, lead times, or security information.
- Automated entity matching or automatic factual publication.
- A generalized relational database migration.

## Autoplan Review Record

Status: `DONE_WITH_CONCERNS`, revised and accepted on 2026-08-26.

### Founder review

- Keep all three source families. Prioritize the reactor backbone, then fuel-cycle facilities, then the narrow oversight snapshot.
- Frame the release around three questions: where reactors are by type and status, where fuel-cycle work happens, and what public NRC oversight signals exist for each reactor.
- Label all new coverage as United States coverage.

### Design review

- Keep Operations unit-level in the table. Avoid finding-level map markers.
- Label Action Matrix data as `NRC oversight response`, never as a safety rating.
- Show missing, zero recorded, and withheld public information as distinct states.
- Use source-provided or explicitly approximate coordinates. Table access remains authoritative when markers overlap.

### Engineering review

- Reconcile the current 95-unit NRC list against the 93-unit 2022 demographic workbook. Current membership and status always win. The older workbook enriches technical attributes only.
- Build one candidate model, then generate the workbook, Sheet payload, static release, and reconciliation report from it.
- Freeze raw sources with URLs, source dates, retrieval UTC, hashes, expected headers, and expected counts.
- Reject unexplained duplicate dockets, unknown Action Matrix codes, broken joins, and implicit location precision.

### Developer experience review

- Stage changes in a candidate workbook. Preserve the approved workbook until validation succeeds.
- Make reruns idempotent by stable IDs. Replace only generated rows and citations. Preserve manual records.
- Print counts for current units, demographic matches, former units, fuel facilities, approximate locations, missing enrichment, exclusions, and conflicts.
- Sync the Google Sheet from the candidate payload, read back changed ranges, then compare normalized values before approving and publishing.

### Resolved implementation decision

No user challenge remains. The user already approved the Sheet-backed static architecture and explicitly authorized production deployment. This release narrows the safety slice without changing the promised outcome.
