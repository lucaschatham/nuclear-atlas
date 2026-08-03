import { readFile } from "node:fs/promises"
import process from "node:process"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"

const root = new URL("../", import.meta.url)
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"))

const [schema, deals] = await Promise.all([
  readJson("data/schema.json"),
  readJson("data/deals.json"),
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

if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}

console.log(`Validated ${deals.length} deals with unique ids and sources.`)
