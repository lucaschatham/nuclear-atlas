import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { csvCell } from "../scripts/csv.mjs"
import { approvalBlocker } from "../scripts/approve-atlas-release.mjs"
import { parseSupportsFields, validateWorkbookTables } from "../scripts/import-atlas-workbook.mjs"

const root = new URL("../", import.meta.url)

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"))
}

test("the static release publishes cited records for every lifecycle stage", async () => {
  const release = await readJson("data/atlas-release.json")
  const deals = await readJson("data/deals.json")
  const stages = [
    "projects",
    "fuel-supply",
    "build-license",
    "operations",
    "spent-fuel",
    "waste-disposal",
    "decommissioning",
  ]

  assert.deepEqual(Object.keys(release.stages), stages)
  assert.equal(release.stages.projects.records.length, 17)
  assert.equal(release.stages["fuel-supply"].records.length, 12)
  assert.equal(release.stages.operations.records.length, 95)
  assert.equal(release.stages["spent-fuel"].records.length, 80)
  assert.equal(release.stages.decommissioning.records.length, 35)
  assert.deepEqual(
    release.stages.projects.records.map((record) => record.id).sort(),
    deals.map((deal) => deal.id).sort(),
    "the Atlas release must preserve the exact existing project identities",
  )
  assert.match(release.workbookSha256, /^[a-f0-9]{64}$/)
  assert.match(release.canonicalModelSha256, /^[a-f0-9]{64}$/)
  assert.notEqual(release.workbookSha256, release.canonicalModelSha256)
  assert.equal(release.reviewStatus, "approved")
  assert.equal(release.approvedBy, "Lucas Chatham")

  for (const stage of stages) {
    const bundle = release.stages[stage]
    assert.equal(bundle.status, "published", `${stage} should be published after user signoff`)
    assert.ok(bundle.records.length >= 3, `${stage} needs at least three records`)
    for (const record of bundle.records) {
      assert.ok(record.citations.length >= 1, `${record.id} has no citation`)
      assert.ok(record.sourceIds.length >= 1, `${record.id} has no source`)
      assert.ok(record.location, `${record.id} has no renderable location`)
    }
  }
})

test("the NRC operations snapshot reports oversight facts without inventing a safety score", async () => {
  const release = await readJson("data/atlas-release.json")
  const records = release.stages.operations.records

  assert.equal(records.length, 95, "the current NRC operating-unit list contains 95 units")
  assert.ok(records.every((record) => record.status === "operating"))
  assert.ok(records.every((record) => record.details.some((detail) => detail.label === "NRC oversight response")))
  const recordsWithFindings = records.filter((record) => record.sourceIds.includes("src_nrc_findings_2024"))
  const recordsWithoutFindings = records.filter((record) => !record.sourceIds.includes("src_nrc_findings_2024"))
  assert.equal(recordsWithFindings.length, 95)
  assert.equal(recordsWithoutFindings.length, 0)
  assert.ok(recordsWithFindings.every((record) => record.metrics.some((metric) => metric.label === "Public findings / violations")))
  assert.ok(recordsWithoutFindings.every((record) => !record.metrics.some((metric) => metric.label === "Public findings / violations")))
  assert.ok(records.every((record) => /Security finding details are not publicly available\./.test(record.summary)))
  assert.ok(records.every((record) => !JSON.stringify(record).toLowerCase().includes("safety score")))
})

test("the spent-fuel snapshot reconciles to the NRC ISFSI license map", async () => {
  const release = await readJson("data/atlas-release.json")
  const records = release.stages["spent-fuel"].records
  const licenseTypes = records.map((record) => record.details.find((detail) => detail.label === "License type")?.value)

  assert.equal(records.length, 80, "the NRC map contains 80 unique ISFSI facilities")
  assert.equal(licenseTypes.filter((value) => value === "general_license").length, 63)
  assert.equal(licenseTypes.filter((value) => value === "site_specific_license").length, 12)
  assert.equal(licenseTypes.filter((value) => value === "general_and_site_specific").length, 5)
  assert.equal(
    licenseTypes.filter((value) => value === "general_license" || value === "general_and_site_specific").length,
    68,
    "general-license count must match the NRC legend",
  )
  assert.equal(
    licenseTypes.filter((value) => value === "site_specific_license" || value === "general_and_site_specific").length,
    17,
    "site-specific-license count must match the NRC legend",
  )
  assert.equal(new Set(records.map((record) => record.location.label.split(", ").at(-1))).size, 37)
  assert.ok(
    records
      .filter((record) => record.location.precision === "state")
      .every((record) => record.asOf === "2024-09-30"),
    "map-derived facilities must retain the NRC snapshot date without misusing inventory_date",
  )
  assert.ok(records.every((record) => record.reviewStatus === "approved"))
})

test("workbook validation rejects missing evidence and broken references", () => {
  const errors = validateWorkbookTables({
    RELEASE: [{ release_id: "release_test", schema_version: "1", review_status: "draft" }],
    SOURCES: [{ source_id: "src_one", publisher: "NRC", source_name: "Source one", source_url: "https://www.nrc.gov/example", reuse_status: "approved_factual_reuse" }],
    SITES: [{ site_id: "site_one", latitude: "   ", longitude: "\t" }],
    REACTORS: [],
    PROJECTS: [],
    FUEL_SUPPLY: [{ facility_id: "fuel_one", site_id: "site_missing", review_status: "approved" }],
    LICENSE_BUILD: [],
    OPERATIONS: [],
    SPENT_FUEL: [],
    WASTE_DISPOSAL: [],
    DECOMMISSIONING: [],
    CITATIONS: [],
  })

  assert.ok(errors.some((error) => error.includes("site_missing")))
  assert.ok(errors.some((error) => error.includes("fuel_one") && error.includes("citation")))
})

test("the canonical workbook model never turns blank numeric values into zero", () => {
  const errors = validateWorkbookTables({
    RELEASE: [{ release_id: "release_test", schema_version: "1", review_status: "draft" }],
    SOURCES: [{ source_id: "src_one", publisher: "NRC", source_name: "Source one", source_url: "https://www.nrc.gov/example", reuse_status: "approved_factual_reuse" }],
    SITES: [{ site_id: "site_one" }],
    REACTORS: [],
    PROJECTS: [],
    FUEL_SUPPLY: [],
    LICENSE_BUILD: [],
    OPERATIONS: [],
    SPENT_FUEL: [{ storage_id: "spent_one", site_id: "site_one", inventory_value: "", review_status: "approved" }],
    WASTE_DISPOSAL: [],
    DECOMMISSIONING: [],
    CITATIONS: [{ citation_id: "cite_one", record_table: "SPENT_FUEL", record_id: "spent_one", source_id: "src_one", review_status: "approved" }],
  })

  assert.deepEqual(errors, [])
})

test("nonblank malformed numeric cells fail validation", () => {
  const errors = validateWorkbookTables({
    RELEASE: [{ release_id: "release_test", schema_version: "1", review_status: "draft" }],
    SOURCES: [{ source_id: "src_one", reuse_status: "approved_factual_reuse" }],
    SITES: [{ site_id: "site_one" }], REACTORS: [], PROJECTS: [], FUEL_SUPPLY: [], LICENSE_BUILD: [],
    OPERATIONS: [{ operation_id: "operation_one", site_id: "site_one", net_generation_mwh: "not a number", review_status: "approved" }],
    SPENT_FUEL: [], WASTE_DISPOSAL: [], DECOMMISSIONING: [],
    CITATIONS: [{ citation_id: "cite_one", record_table: "OPERATIONS", record_id: "operation_one", source_id: "src_one", review_status: "approved" }],
  })

  assert.ok(errors.some((error) => error.includes("operation_one") && error.includes("net_generation_mwh")))
})

test("record IDs remain globally unique across lifecycle tables", () => {
  const errors = validateWorkbookTables({
    RELEASE: [{ release_id: "release_test", schema_version: "1", review_status: "draft" }],
    SOURCES: [{ source_id: "src_one", reuse_status: "approved_factual_reuse" }],
    SITES: [{ site_id: "site_one" }],
    REACTORS: [],
    PROJECTS: [{ project_id: "shared_id", site_id: "site_one", review_status: "needs_review" }],
    FUEL_SUPPLY: [{ facility_id: "shared_id", site_id: "site_one", review_status: "needs_review" }],
    LICENSE_BUILD: [],
    OPERATIONS: [],
    SPENT_FUEL: [],
    WASTE_DISPOSAL: [],
    DECOMMISSIONING: [],
    CITATIONS: [],
  })

  assert.ok(errors.some((error) => error.includes("shared_id") && error.includes("already used")))
})

test("blocked sources cannot support public lifecycle records", () => {
  const errors = validateWorkbookTables({
    RELEASE: [{ release_id: "release_test", schema_version: "1", review_status: "draft" }],
    SOURCES: [{ source_id: "src_blocked", reuse_status: "blocked" }],
    SITES: [{ site_id: "site_one" }],
    REACTORS: [],
    PROJECTS: [],
    FUEL_SUPPLY: [{ facility_id: "fuel_one", site_id: "site_one", review_status: "approved" }],
    LICENSE_BUILD: [],
    OPERATIONS: [],
    SPENT_FUEL: [],
    WASTE_DISPOSAL: [],
    DECOMMISSIONING: [],
    CITATIONS: [{ citation_id: "cite_blocked", record_table: "FUEL_SUPPLY", record_id: "fuel_one", source_id: "src_blocked", review_status: "approved" }],
  })

  assert.ok(errors.some((error) => error.includes("src_blocked") && error.includes("cannot publish")))
})

test("every publishable review state still requires a citation", () => {
  const errors = validateWorkbookTables({
    RELEASE: [{ release_id: "release_test", schema_version: "1", review_status: "draft" }],
    SOURCES: [],
    SITES: [{ site_id: "site_one" }],
    REACTORS: [],
    PROJECTS: [{ project_id: "project_uncited", site_id: "site_one", review_status: "needs_review" }],
    FUEL_SUPPLY: [],
    LICENSE_BUILD: [],
    OPERATIONS: [],
    SPENT_FUEL: [],
    WASTE_DISPOSAL: [],
    DECOMMISSIONING: [],
    CITATIONS: [],
  })

  assert.ok(errors.some((error) => error.includes("project_uncited") && error.includes("citation")))
})

test("the workbook contains exactly one release declaration", () => {
  const errors = validateWorkbookTables({
    RELEASE: [
      { release_id: "release_one", schema_version: "1", review_status: "draft" },
      { release_id: "release_two", schema_version: "1", review_status: "draft" },
    ],
    SOURCES: [], SITES: [], REACTORS: [], PROJECTS: [], FUEL_SUPPLY: [], LICENSE_BUILD: [],
    OPERATIONS: [], SPENT_FUEL: [], WASTE_DISPOSAL: [], DECOMMISSIONING: [], CITATIONS: [],
  })

  assert.ok(errors.some((error) => error.includes("exactly one row")))
})

test("an approved release must name its approver", () => {
  const errors = validateWorkbookTables({
    RELEASE: [{ release_id: "release_test", schema_version: "1", review_status: "approved", approved_by: "" }],
    SOURCES: [], SITES: [], REACTORS: [], PROJECTS: [], FUEL_SUPPLY: [], LICENSE_BUILD: [],
    OPERATIONS: [], SPENT_FUEL: [], WASTE_DISPOSAL: [], DECOMMISSIONING: [], CITATIONS: [],
  })

  assert.ok(errors.some((error) => error.includes("approved_by")))
})

test("an approved release cannot contain unresolved records or citations", () => {
  const errors = validateWorkbookTables({
    RELEASE: [{ release_id: "release_test", schema_version: "1", review_status: "approved", approved_by: "Reviewer" }],
    SOURCES: [{ source_id: "src_one", publisher: "NRC", source_name: "Source one", source_url: "https://www.nrc.gov/example", reuse_status: "approved_factual_reuse" }],
    SITES: [{ site_id: "site_one" }], REACTORS: [], PROJECTS: [],
    FUEL_SUPPLY: [{ facility_id: "fuel_one", site_id: "site_one", review_status: "needs_review" }],
    LICENSE_BUILD: [], OPERATIONS: [], SPENT_FUEL: [], WASTE_DISPOSAL: [], DECOMMISSIONING: [],
    CITATIONS: [{ citation_id: "cite_one", record_table: "FUEL_SUPPLY", record_id: "fuel_one", source_id: "src_one", review_status: "needs_review" }],
  })

  assert.ok(errors.some((error) => error.includes("fuel_one") && error.includes("approved release")))
  assert.ok(errors.some((error) => error.includes("cite_one") && error.includes("approved release")))
})

test("release approval never promotes an unresolved row", () => {
  assert.match(approvalBlocker("SPENT_FUEL", "spent_one", "needs_review"), /row-level review/)
  assert.match(approvalBlocker("SPENT_FUEL", "spent_one", "conflicting"), /conflicting/)
  assert.equal(approvalBlocker("SPENT_FUEL", "spent_one", "approved"), null)
  assert.equal(approvalBlocker("SPENT_FUEL", "spent_one", "excluded"), null)
  assert.match(approvalBlocker("CITATIONS", "cite_one", "excluded", { citation: true }), /unsupported release status/)
})

test("lifecycle records reject unknown review states instead of disappearing", () => {
  const errors = validateWorkbookTables({
    RELEASE: [{ release_id: "release_test", schema_version: "1", review_status: "draft" }],
    SOURCES: [], SITES: [{ site_id: "site_one" }], REACTORS: [],
    PROJECTS: [{ project_id: "project_one", site_id: "site_one", review_status: "aproved" }],
    FUEL_SUPPLY: [], LICENSE_BUILD: [], OPERATIONS: [], SPENT_FUEL: [], WASTE_DISPOSAL: [],
    DECOMMISSIONING: [], CITATIONS: [],
  })

  assert.ok(errors.some((error) => error.includes("project_one") && error.includes("review status")))
})

test("CSV downloads neutralize spreadsheet formulas without changing numbers", () => {
  assert.equal(csvCell("=HYPERLINK(\"https://example.com\")"), "\"'=HYPERLINK(\"\"https://example.com\"\")\"")
  assert.equal(csvCell("  @SUM(A1:A2)"), "'  @SUM(A1:A2)")
  assert.equal(csvCell("-2+3"), "'-2+3")
  assert.equal(csvCell(-20), "-20")
  assert.equal(csvCell("line one\rline two"), '"line one\rline two"')
})

test("publishable evidence requires complete source citation metadata", () => {
  const errors = validateWorkbookTables({
    RELEASE: [{ release_id: "release_test", schema_version: "1", review_status: "draft" }],
    SOURCES: [{ source_id: "src_incomplete", publisher: "", source_name: "", source_url: "not-a-url", reuse_status: "approved_factual_reuse" }],
    SITES: [{ site_id: "site_one" }], REACTORS: [], PROJECTS: [],
    FUEL_SUPPLY: [{ facility_id: "fuel_one", site_id: "site_one", review_status: "approved" }],
    LICENSE_BUILD: [], OPERATIONS: [], SPENT_FUEL: [], WASTE_DISPOSAL: [], DECOMMISSIONING: [],
    CITATIONS: [{ citation_id: "cite_incomplete", record_table: "FUEL_SUPPLY", record_id: "fuel_one", source_id: "src_incomplete", review_status: "approved" }],
  })

  assert.ok(errors.some((error) => error.includes("src_incomplete") && error.includes("publisher")))
  assert.ok(errors.some((error) => error.includes("src_incomplete") && error.includes("source_name")))
  assert.ok(errors.some((error) => error.includes("src_incomplete") && error.includes("HTTP")))
  assert.ok(errors.some((error) => error.includes("fuel_one") && error.includes("citation")))
})

test("every public source inspector link must use HTTP or HTTPS", () => {
  const errors = validateWorkbookTables({
    RELEASE: [{ release_id: "release_test", schema_version: "1", review_status: "draft" }],
    SOURCES: [{ source_id: "src_blocked", publisher: "Example", source_name: "Blocked source", source_url: "javascript:alert(1)", reuse_status: "blocked" }],
    SITES: [], REACTORS: [], PROJECTS: [], FUEL_SUPPLY: [], LICENSE_BUILD: [],
    OPERATIONS: [], SPENT_FUEL: [], WASTE_DISPOSAL: [], DECOMMISSIONING: [], CITATIONS: [],
  })

  assert.ok(errors.some((error) => error.includes("src_blocked") && error.includes("HTTP")))
})

test("citations must target an existing lifecycle record", () => {
  const errors = validateWorkbookTables({
    RELEASE: [{ release_id: "release_test", schema_version: "1", review_status: "draft" }],
    SOURCES: [{ source_id: "src_one", publisher: "NRC", source_name: "Source one", source_url: "https://www.nrc.gov/example", reuse_status: "approved_factual_reuse" }],
    SITES: [], REACTORS: [], PROJECTS: [], FUEL_SUPPLY: [], LICENSE_BUILD: [], OPERATIONS: [], SPENT_FUEL: [], WASTE_DISPOSAL: [], DECOMMISSIONING: [],
    CITATIONS: [
      { citation_id: "cite_orphan", record_table: "SPENT_FUEL", record_id: "spent_typo", source_id: "src_one", review_status: "approved" },
      { citation_id: "cite_bad_table", record_table: "UNKNOWN_TABLE", record_id: "anything", source_id: "src_one", review_status: "approved" },
    ],
  })

  assert.ok(errors.some((error) => error.includes("cite_orphan") && error.includes("spent_typo")))
  assert.ok(errors.some((error) => error.includes("cite_bad_table") && error.includes("UNKNOWN_TABLE")))
})

test("citation support lists split field names but preserve prose commas", () => {
  assert.deepEqual(parseSupportsFields("status,capacity_value,status_as_of"), ["status", "capacity_value", "status_as_of"])
  assert.deepEqual(parseSupportsFields("Expanded PPA, 1,920 MW, delivery through 2042."), ["Expanded PPA, 1,920 MW, delivery through 2042."])
})

test("a citation without an approved source cannot make a row publishable", () => {
  const errors = validateWorkbookTables({
    RELEASE: [{ release_id: "release_test", schema_version: "1", review_status: "draft" }],
    SOURCES: [],
    SITES: [{ site_id: "site_one", latitude: 35, longitude: -80, location_precision: "site" }],
    REACTORS: [],
    PROJECTS: [{ project_id: "project_one", site_id: "site_one", review_status: "approved" }],
    FUEL_SUPPLY: [], LICENSE_BUILD: [], OPERATIONS: [], SPENT_FUEL: [], WASTE_DISPOSAL: [], DECOMMISSIONING: [],
    CITATIONS: [{ citation_id: "cite_missing_source", record_table: "PROJECTS", record_id: "project_one", source_id: "", review_status: "approved" }],
  })

  assert.ok(errors.some((error) => error.includes("project_one") && error.includes("citation")))
  assert.ok(errors.some((error) => error.includes("cite_missing_source") && error.includes("source_id")))
})

test("site coordinates and precision are validated before records inherit them", () => {
  const errors = validateWorkbookTables({
    RELEASE: [{ release_id: "release_test", schema_version: "1", review_status: "draft" }],
    SOURCES: [],
    SITES: [{ site_id: "site_bad", latitude: 200, longitude: "", location_precision: "rooftop" }],
    REACTORS: [], PROJECTS: [], FUEL_SUPPLY: [], LICENSE_BUILD: [], OPERATIONS: [], SPENT_FUEL: [],
    WASTE_DISPOSAL: [], DECOMMISSIONING: [], CITATIONS: [],
  })

  assert.ok(errors.some((error) => error.includes("site_bad") && error.includes("both latitude")))
  assert.ok(errors.some((error) => error.includes("site_bad") && error.includes("invalid latitude")))
  assert.ok(errors.some((error) => error.includes("site_bad") && error.includes("location precision")))
})
