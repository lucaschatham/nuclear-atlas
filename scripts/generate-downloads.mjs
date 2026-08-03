import { mkdir, readFile, writeFile } from "node:fs/promises"

const root = new URL("../", import.meta.url)
const deals = JSON.parse(await readFile(new URL("data/deals.json", root), "utf8"))
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
console.log(`Generated JSON and CSV downloads for ${deals.length} deals.`)
