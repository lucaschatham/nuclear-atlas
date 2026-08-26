import { readFile } from "node:fs/promises"
import process from "node:process"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"

const root = new URL("../", import.meta.url)
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"))

const [schema, deals, atlasRelease] = await Promise.all([
  readJson("data/schema.json"),
  readJson("data/deals.json"),
  readJson("data/atlas-release.json"),
])

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
const validate = ajv.compile(schema)
const valid = validate(deals)

const errors = []
if (!valid) {
  errors.push(...(validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`))
}

const ids = new Set()
for (const deal of deals) {
  if (ids.has(deal.id)) errors.push(`/ duplicate id: ${deal.id}`)
  ids.add(deal.id)
  if (!Array.isArray(deal.sources) || deal.sources.length === 0) {
    errors.push(`/${deal.id} must include at least one source`)
  }
}

const expectedStages = ["projects", "fuel-supply", "build-license", "operations", "spent-fuel", "waste-disposal", "decommissioning"]
if (JSON.stringify(Object.keys(atlasRelease.stages)) !== JSON.stringify(expectedStages)) {
  errors.push("/atlas-release lifecycle stages are missing or out of order")
}
const sourceIds = new Set(atlasRelease.sources.map((source) => source.id))
for (const stage of expectedStages) {
  const bundle = atlasRelease.stages[stage]
  if (!bundle || bundle.records.length === 0) errors.push(`/atlas-release/${stage} must contain records`)
  for (const record of bundle?.records ?? []) {
    if (record.stage !== stage) errors.push(`/atlas-release/${stage}/${record.id} has mismatched stage`)
    if (!record.location) errors.push(`/atlas-release/${stage}/${record.id} has no renderable location`)
    if (!record.citations?.length) errors.push(`/atlas-release/${stage}/${record.id} has no citation`)
    for (const citation of record.citations ?? []) {
      if (!sourceIds.has(citation.sourceId)) errors.push(`/atlas-release/${stage}/${record.id} references unknown source ${citation.sourceId}`)
    }
  }
}
const dealIds = [...ids].sort()
const atlasProjectIds = (atlasRelease.stages.projects?.records ?? []).map((record) => record.id).sort()
const missingProjectIds = dealIds.filter((id) => !atlasProjectIds.includes(id))
const extraProjectIds = atlasProjectIds.filter((id) => !ids.has(id))
if (missingProjectIds.length || extraProjectIds.length) {
  errors.push(`/atlas-release/projects must preserve the exact existing project IDs; missing: ${missingProjectIds.join(", ") || "none"}; extra: ${extraProjectIds.join(", ") || "none"}`)
}

if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}

console.log(`Validated ${deals.length} deal aliases and ${expectedStages.length} populated lifecycle stages.`)
