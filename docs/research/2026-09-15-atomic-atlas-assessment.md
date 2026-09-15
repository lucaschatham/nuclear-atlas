# Atomic Atlas source assessment

Inspected https://www.atomicatlas.fyi/ on September 15, 2026 through its public
browser interface. No data has been imported into Nuclear Atlas or published as
verified evidence from this site.

## Useful discovery inputs

| Section | Visible rows | Candidate fields | Recommended treatment |
| --- | ---: | --- | --- |
| Fission | 28 | Developer, country, design, family, power and unit, coolant | Seed an entity/design research list; verify each specification with the developer or regulator. |
| Fusion | 15 | Developer, approach, confinement, machine | Keep as a separate future coverage list; verify funding and target dates independently. |
| Supply Chain | 5 | Supplier, country, capabilities, stated customers | Highest-value lead list for supplier coverage. Customer relationships and production capacity require original sources. |
| Fuel Cycle | 4 | Fuel category, enrichment, form factor, users | Use as research prompts, not a fuel specification standard or supplier availability feed. |
| Projects | 10 | Project, developer, site label, status, target year | Match existing Atlas records and locate primary licensing/project evidence before adding or changing facts. |

## Technical extraction

The observed interface renders tabular content through client-side React. The
browser loaded public JavaScript libraries but no separate data API requests were
observed while opening these five tabs. A small browser extractor can click each
tab and read table cells. No account was required to view them. This does not
establish that a supported API, bulk download, or stable schema exists.

Preserve source URL, section, collection timestamp, and original field labels in
any future local candidate snapshot. Separate country labels from site locations;
do not convert location text to precise coordinates without location evidence.
Keep MWe and MWth distinct. Do not infer available capacity from design ratings.

## Accuracy and reuse limits

No row-level citations, per-record update dates, or explicit reuse license were
visible in the inspected tables. The footer displays copyright. No policy link was
visible; /robots.txt, /terms, and /license returned 404. Missing policy pages do not
establish permission to republish their compilation, editorial text, or graphics.
Use entity names as research leads and build our published facts from original
sources. Confirm reuse terms before mirroring the site's dataset.

One concrete discrepancy: the Projects table labels Dow Seadrift as having an
"ESP submitted to NRC." Dow's March 31, 2025 announcement identifies a
**construction permit application**, and DOE describes NRC docketing that
application. An early site permit and a construction permit are different licensing
steps. Do not carry over this status string into Atlas.

- https://corporate.dow.com/en-us/news/press-releases/dow-and-x-energy-submit-construction-permit-application-to-the-u.html
- https://www.energy.gov/ne/articles/nrc-dockets-construction-permit-application-dow-advanced-reactor-project

## Recommended next slice

Research the five listed suppliers against their own product and project sources,
then compare the ten projects against existing Atlas records. Keep candidate
extraction local and unreviewed. Defer copied explanatory material, calculators,
funding totals, target dates, and geographic precision until independently supported.
