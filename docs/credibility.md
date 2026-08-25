# Credibility pipeline

Nuclear Notebook checks approved public sources every 24 hours. It preserves the distinction between when Nuclear Notebook checked a source, when the publisher updated it, and when the underlying event took effect.

The pipeline does not publish new factual claims automatically. It creates receipts and review candidates on a rolling pull-request branch. A person must review and merge evidence. Only GitHub scheduler run IDs count toward the proof gate; manual and prelaunch checks remain visible but excluded.

## Data model

The credibility layer uses three append-only records:

1. `SourceDefinition` records who owns a source, which claim types it can support, its expected cadence, its access terms, and whether automation is approved.
2. `RetrievalReceipt` records every scheduled or manual attempt, including unchanged responses and failures. It stores both a raw payload hash and a canonical record hash.
3. `EvidenceEvent` records a claim, its stable claim key, exact document and locator, the receipt used to retrieve it, its authority class, and its review state. Conflict and supersession checks operate on one project and claim key, not a broad category.

Current project fields are a projection of approved evidence. A missing record never means zero, cancelled, rejected, or unavailable.

## Authority classes

Authority is claim-specific. Higher authority in one domain does not make a source authoritative in every domain.

| Class | Appropriate use |
|---|---|
| `official_legal` | Official legal editions and final legal instruments |
| `official_regulatory` | Licenses, orders, inspections, dockets, and regulatory status |
| `official_government` | Awards, statistics, notices, and public administrative records |
| `counterparty_filing` | Statements filed by a project participant with a regulator |
| `counterparty_statement` | Press releases, investor materials, and utility publications |
| `independent_primary` | Grid operators and other primary non-government record owners |
| `secondary_discovery` | Leads that must be traced to a stronger source |

The system does not calculate a composite credibility score.

`source-probes.json` records the initial 12-source access exercise. A blocked preflight remains blocked. It does not become a successful probe merely because a documentation page is reachable.

## Run the pipeline

Probe approved adapters without writing data:

```bash
npm run credibility:probe
```

Run a manual collection locally and write receipts, candidate records, source status, and raw review artifacts:

```bash
npm run credibility:run
```

Validate the full ledger and inspect the current proof gate:

```bash
npm run validate:credibility
npm run credibility:proof
```

Capture a document that requires human retrieval:

```bash
npm run credibility:record-manual -- \
  --source constellation-investor-relations \
  --url https://investors.constellationenergy.com/example \
  --file /absolute/path/to/reviewed-document.html \
  --content-type text/html \
  --published-at 2026-08-25T00:00:00.000Z
```

The command never fetches the URL. It reads the named local file, enforces the source host allowlist and byte limit, hashes the exact bytes, and appends a manual receipt. The file stays outside Git unless its source registry policy expressly permits an archive. The reviewer must still create the `EvidenceEvent` with an exact locator.

Raw changed-source bodies are written to `.credibility-artifacts/` and remain untracked. The workflow retains them for 90 days as review artifacts. Git stores append-only receipt metadata and one normalized record snapshot per changed receipt. Each receipt names that tracked archive path. An empty incremental response records a successful check but never replaces an earlier candidate.

## Daily review

1. Open the rolling “Daily credibility source review” pull request.
2. Check `source-status.json` for blocked authentication, failures, stale publication dates, and record-count changes.
3. Inspect each changed candidate and the matching raw workflow artifact.
4. Confirm that the adapter returned a complete result set. Pagination uncertainty blocks publication.
5. Create or update an `EvidenceEvent` only when a record supports a named project claim.
6. Add the exact accession, filing identifier, page, section, table, or field locator.
7. Set the event to `reviewed` only after attaching a valid receipt. Keep unresolved material differences visible as `conflicting`.
8. Record the review in `proof-reviews.json`, including elapsed minutes, distinct audited and reproduced event IDs, corrections, and scenario checks. Counters must equal the distinct ID sets.
9. Run the test, validation, and build commands before merging.

Observed seed events deliberately use `retrieval_receipt_id: null`. They are quarantined and excluded from public output until the proof review supplies exact locators and receipts.

## Add a source

1. Define the exact claim types the source can support.
2. Record the official endpoint, publisher, authority class, geographic scope, expected source cadence, polling interval, terms URL, archival policy, and allowed hosts.
3. Prefer API, RSS, bulk, or structured dataset access.
4. Keep HTML, PDF, Power BI, local portals, and unclear terms in `manual_only` or `candidate` state.
5. Implement a bounded adapter with an explicit schema and empty-response rule.
6. Add fixtures for valid, malformed, empty, partial, and changed responses.
7. Live-probe the source and move it to `probed`.
8. Approve automation only after access terms, pagination, source identifiers, and failure behavior pass review.

Approved adapters use host allowlists, HTTPS, response-size limits, timeouts, credential redaction, raw and canonical hashes, and source-native timestamps. API keys belong in GitHub Secrets. Copy `.env.example` for local names, then use real values only in an untracked environment file.

## Failure policy

- Authentication failures become `blocked_auth` receipts.
- Timeouts, rate limits, unavailable sources, malformed payloads, unexpected empty data, schema drift, and incomplete pagination block the run.
- Failure receipts retain the previous successful hash and timestamp in source status.
- No error handler may erase evidence or replace a prior fact with null.
- Conflicting reviewed claims block validation until they are explicitly marked conflicting, superseded, or retracted.
- The scheduled workflow opens or updates a failure issue and still preserves reviewable failure metadata.

## Fourteen-day proof gate

`npm run credibility:proof` evaluates the mechanical gate:

- 14 consecutive complete scheduled runs across every approved automated source
- traceable reviewed evidence for all five pilot projects
- 20 of 20 audited claims reproduced from their sources
- outage, correction, retraction, conflict, and schema-drift tests recorded
- documented terms for every automated source
- zero critical published errors
- no more than 30 minutes of review time for each of the final three reviews

The gate begins closed. Dashboard expansion and field-level automatic publishing remain blocked until every criterion passes.
