import { mkdir, readFile, writeFile } from "node:fs/promises"

import { buildProofStatusFromFiles } from "./credibility/proof.mjs"

const root = new URL("../", import.meta.url)
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"))
const [deals, sourceRegistry, sourceStatus, sourceProbes, evidenceEvents, proofStatus] = await Promise.all([
  readJson("data/deals.json"),
  readJson("data/credibility/sources.json"),
  readJson("data/credibility/source-status.json"),
  readJson("data/credibility/source-probes.json"),
  readJson("data/credibility/evidence-events.json"),
  buildProofStatusFromFiles({ rootUrl: root }),
])
const outputDirectory = new URL("public/data/", root)

const columns = [
  "id",
  "name",
  "offtaker",
  "offtaker_type",
  "developer",
  "technology_vendor",
  "utility",
  "epc",
  "technology",
  "mw_firm",
  "mw_optioned",
  "structure_type",
  "bindingness_tier",
  "bindingness_evidence",
  "announced",
  "target_cod",
  "site",
  "state",
  "country",
  "grid_region",
  "analyst_note",
  "needs_verification",
  "last_verified",
  "source_urls",
]

const quote = (value) => {
  if (value === null || value === undefined) return ""
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const rows = deals.map((deal) => ({
  id: deal.id,
  name: deal.name,
  offtaker: deal.parties.offtaker,
  offtaker_type: deal.parties.offtaker_type,
  developer: deal.parties.developer,
  technology_vendor: deal.parties.technology_vendor,
  utility: deal.parties.utility,
  epc: deal.parties.epc,
  technology: deal.technology,
  mw_firm: deal.mw_firm,
  mw_optioned: deal.mw_optioned,
  structure_type: deal.structure_type,
  bindingness_tier: deal.bindingness.tier,
  bindingness_evidence: deal.bindingness.evidence,
  announced: deal.dates.announced,
  target_cod: deal.dates.target_cod,
  site: deal.location.site,
  state: deal.location.state,
  country: deal.location.country,
  grid_region: deal.location.grid_region,
  analyst_note: deal.analyst_note,
  needs_verification: deal.needs_verification,
  last_verified: deal.last_verified,
  source_urls: deal.sources.map((source) => source.url).join(" | "),
}))

const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => quote(row[column])).join(","))].join("\n")

await mkdir(outputDirectory, { recursive: true })
await writeFile(new URL("deals.json", outputDirectory), `${JSON.stringify(deals, null, 2)}\n`)
await writeFile(new URL("deals.csv", outputDirectory), `${csv}\n`)

const publicSourceRegistry = sourceRegistry.map((source) => ({
  id: source.id,
  name: source.name,
  publisher: source.publisher,
  authority_class: source.authority_class,
  geographic_scope: source.geographic_scope,
  endpoint: source.endpoint,
  access_method: source.access_method,
  auth_method: source.auth_method,
  terms_url: source.terms_url,
  archival_policy: source.archival_policy,
  expected_cadence: source.expected_cadence,
  polling_interval_hours: source.polling_interval_hours,
  supported_claim_types: source.supported_claim_types,
  adapter_version: source.adapter_version,
  operational_state: source.operational_state,
  notes: source.notes,
}))
const publicEvidenceEvents = evidenceEvents.filter((event) =>
  ["reviewed", "published", "superseded", "retracted"].includes(event.review_state),
)

await writeFile(new URL("source-registry.json", outputDirectory), `${JSON.stringify(publicSourceRegistry, null, 2)}\n`)
await writeFile(new URL("source-status.json", outputDirectory), `${JSON.stringify(sourceStatus, null, 2)}\n`)
await writeFile(new URL("source-probes.json", outputDirectory), `${JSON.stringify(sourceProbes, null, 2)}\n`)
await writeFile(new URL("evidence-events.json", outputDirectory), `${JSON.stringify(publicEvidenceEvents, null, 2)}\n`)
await writeFile(new URL("credibility-proof.json", outputDirectory), `${JSON.stringify(proofStatus, null, 2)}\n`)
console.log(`Generated deal downloads and credibility outputs for ${deals.length} deals and ${sourceRegistry.length} sources.`)
