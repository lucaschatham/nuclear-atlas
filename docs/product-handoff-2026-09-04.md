# Nuclear Atlas product assessment

Inspected September 4, 2026. Starting commit: `ff6f738c5163149cbfaaf2fc27b18576b1e5f345`, clean `main`.

## Goal and success criteria

Make public nuclear evidence useful for finding facilities, comparing published status, and understanding what supports each claim. Success means a user can find a facility in Map or Table, inspect its evidence and dates, distinguish unknowns from known values, and reproduce the claim from its cited source. Global framing must not imply global coverage.

Assumption: improve the existing product incrementally, preserve the reviewed static release and public URLs, and prioritize real evidence workflows over speculative models. No new database is needed for the next useful slice.

## Verified implementation

- Next.js static export with server route boundaries, a dedicated client workspace, shared filtering, and a shared evidence inspector.
- Release `release_2026-08-26_v2`: 247 records across seven stages (17 Projects, 12 Fuel Supply, 4 Build & License, 95 Operations, 80 Spent Fuel, 4 Waste & Disposal, 35 Decommissioning).
- The authoring workbook produces the approved JSON boundary. Browser requests do not read Google Sheets.
- Citation fields already include source-native dates and precision, effective dates, UTC retrieval times, locators, supported fields, and review status. Source authority is in the release source registry.
- The source registry marks four adapters approved for automation: NRC daily reactor status, Federal Register NRC documents, USAspending, and Grants.gov. ADAMS is manual-only. DOE OSTI and SEC EDGAR are probed, not approved automated sources.
- Locally committed source-status receipts end August 25, 2026. This does not establish the present health of remote scheduled jobs.
- The production homepage returned HTTP 200 during this inspection. No deployment was performed.

ADAMS is operated by the NRC, as confirmed by its [official API portal](https://adams-api-developer.nrc.gov/). A reachable portal does not establish working authenticated ingestion.

## First implemented improvement

Expose citation provenance in the shared inspector. Previously, citation buttons showed publisher and source date, while most of the evidence needed for an audit stayed hidden. Each citation now names its source and authority, supported fields, document locator, original date and precision, effective date, retrieval instant, and Atlas review status. Missing metadata stays explicit. Source dates are never inferred from retrieval time.

The browser regression cases use Nine Mile Point 1, which combines differently dated NRC sources, and Fermi 3, whose 2015 license effective date differs from its 2026 source publication date. The same component serves desktop and mobile inspectors.

## Remaining priorities

1. Verify the remote collection workflow and review backlog, then produce a deliberately reviewed fresh release. Local configuration alone does not prove daily execution or current evidence.
2. Preserve locationless records in Table. `createAtlasRecords` currently drops any record with a null location. All current release records have coordinates, but future incomplete records would disappear from both views. Map should explain unmapped counts instead of inventing coordinates.
3. Reconcile product documentation at its source. README still leads with nuclear power deals, and generated methodology copy retains Projects-only language. Update the methodology contract and regenerate its artifacts together.
4. Add stable record links and clearer coverage information, then validate search and comparison tasks with industry users. Reactor-type filtering exists for Operations, but does not constitute a complete global reactor registry.
5. Expand one source-backed question at a time. Global source redistribution, generation histories, outage economics, and safety comparisons require separate evidence and methodology work.

The longer-term vision remains incomplete. This first slice improves auditability without claiming new data coverage or freshness.
