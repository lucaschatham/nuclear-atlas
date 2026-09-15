# Targeted licensing release

Release: `release_2026-09-15_licensing_update`.

Five licensing actions were checked against NRC/CNSC public pages on September 15, 2026. Codex performed the source review under the user's explicit publication authorization. No independent human source review is recorded. Atomic Atlas supplied discovery leads; it is not the evidence source for these claims.

The workbook is the authoring source. The generated release contains 252 records, 55 sources, and 562 citations. All 247 earlier record objects remain unchanged. The August 26 baseline is retained; the five additions carry their own evidence dates.

| Workbook record | Evidence and date handling | Geographic representation |
| --- | --- | --- |
| `license_long_mott_construction` | NRC application received March 31, 2025; docketing accepted May 12, 2025. Review ongoing on the inspected page. No permit decision or effective date inferred. | Census 2025 Calhoun County internal point, GEOID 48057. County precision. |
| `license_clinch_river_construction` | NRC construction permit review; decision remains a fall 2026 target. Environmental and safety application parts have separate dates, so the single application date is blank. Early site permit is separate. | Census 2025 Tennessee internal point, GEOID 47. State precision. |
| `license_kemmerer_1_construction` | NRC staff issuance of CPAR-1, March 9, 2026. This is construction authorization, not operating authorization. No effective date inferred. | Census 2025 Wyoming internal point, GEOID 56. State precision. |
| `license_darlington_1_construction` | CNSC April 4, 2025 construction-licence decision announcement for one BWRX-300. October 2022 application remains month precision in descriptive evidence; exact application date blank. | NRCan official Ontario point, CGNDB FEHRI. Province represented by existing `state` precision enum. |
| `license_hermes_construction` | NRC December 14, 2023 permit issuance; distinct from the December 12 decision milestone. Non-electric test reactor, not Hermes 2. Application parts have different dates, so no single application date inferred. | Census 2025 Tennessee internal point, GEOID 47. State precision. |

The UI labels the date as "Decision / issuance date". No marker claims to identify a verified facility site. Government gazetteer points represent administrative areas and are not necessarily geometric centroids. The locality text names the facility's reported locality independently of the approximate marker. Two Tennessee records share a representative point; search/filter isolates each record without moving the source coordinate.

## Evidence and reproduction

Each populated factual workbook field has a supporting citation. Gazetteer citations cover representative coordinates and precision, while regulator citations cover the facility and licensing facts. Companion regulator pages are identified in locators where a description summarizes more than one document.

Local evidence is preserved under `.local-data/licensing-2026-09-15/`, including the previous release/workbook, government HTML and geographic responses, retrieval metadata, hashes, reviewed additions, and the one-time workbook preparation script. Direct NRC HTML requests returned 403; its publicly accessible content was reviewed and preserved as a web-tool text extraction, explicitly labelled as an extraction rather than original HTML bytes. No authenticated source or credential was needed.

The new release was imported through the existing local SQLite release importer. Readback confirmed one release collection with 252 records and all five additions with their 12 citations; foreign-key checks passed. Earlier archive collections remain intact. Raw local files and database backups are excluded from Git and browser assets.

## Verification and rollback

Regression tests check the five identities, application/permit distinctions, missing dates, field-specific citations, map/table eligibility, and an exact hash of the original 247 records. Browser tests cover desktop/mobile evidence panels, each filtered map marker, citation destinations, changelog navigation and baseline wording.

The baseline release is preserved in Git commit `5b3c84c84a7d68cb5ad6b9ab5f9cb5cee2e2d28f` and in the local evidence folder. To roll back a failed publication, revert the targeted release commit and deploy through the existing workflow. Do not delete SQLite history.
