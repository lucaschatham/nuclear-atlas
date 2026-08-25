import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../", import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

async function readJson(path) {
  return JSON.parse(await read(path))
}

test("atlas maps every deal without inventing precise undisclosed locations", async () => {
  const [deals, locations] = await Promise.all([
    readJson("data/deals.json"),
    readJson("data/atlas-locations.json"),
  ])

  assert.deepEqual(
    locations.map((location) => location.deal_id).sort(),
    deals.map((deal) => deal.id).sort(),
  )

  const allowedPrecision = new Set(["site", "county", "state", "region", "country"])
  for (const location of locations) {
    assert.ok(allowedPrecision.has(location.precision), `${location.deal_id} has invalid precision`)
    assert.ok(location.latitude >= -90 && location.latitude <= 90)
    assert.ok(location.longitude >= -180 && location.longitude <= 180)
    assert.match(location.display_label, /\S/)
    assert.match(location.coordinate_note, /\S/)
    assert.match(location.source_url, /^https:\/\//)

    const deal = deals.find((item) => item.id === location.deal_id)
    const undisclosed = /not disclosed|multiple sites|potential sites|covered u\.s\.|two planned/i.test(deal.location.site ?? "")
    if (undisclosed) {
      assert.notEqual(location.precision, "site", `${deal.id} claims site precision for an undisclosed location`)
    }
  }
})

test("production atlas keeps lifecycle navigation primary and personas optional", async () => {
  const [component, model, page, packageJson] = await Promise.all([
    read("src/features/atlas/atlas-workspace.tsx"),
    read("src/lib/atlas-workspace.ts"),
    read("src/app/page.tsx"),
    readJson("package.json"),
  ])

  const lifecycle = [
    "Projects",
    "Fuel Supply",
    "Build & License",
    "Operations",
    "Spent Fuel",
    "Waste & Disposal",
    "Decommissioning",
  ]

  let cursor = -1
  for (const stage of lifecycle) {
    const next = model.indexOf(stage)
    assert.ok(next > cursor, `${stage} is missing or out of lifecycle order`)
    cursor = next
  }

  assert.match(component, /personaConfig/)
  assert.match(model, /All evidence/)
  assert.match(component, /Coverage gap, not a known zero/)
  assert.match(component, /AtlasMap/)
  assert.match(component, /AtlasDataTable/)
  assert.match(page, /AtlasWorkspace/)
  assert.equal(packageJson.dependencies["maplibre-gl"]?.length > 0, true)
})

test("atlas exposes source evidence through one shared map and table workspace", async () => {
  const [component, inspector, page, layout] = await Promise.all([
    read("src/features/atlas/atlas-workspace.tsx"),
    read("src/features/atlas/atlas-inspectors.tsx"),
    read("src/app/page.tsx"),
    read("src/app/layout.tsx"),
  ])

  assert.match(component, /source/i)
  assert.match(component, /evidence/i)
  assert.match(inspector, /Last verified/i)
  assert.match(inspector, /href={`\/deal\//)
  assert.match(component, /DownloadButtons/)
  assert.doesNotMatch(page, /DealExplorer/)
  assert.match(layout, /https:\/\/nuclearatlas\.lucaschatham\.com/)
})

test("map surface fills the atlas panel after MapLibre adds its root class", async () => {
  const [mapComponent, globalCss] = await Promise.all([
    read("src/features/atlas/atlas-map.tsx"),
    read("src/app/globals.css"),
  ])

  assert.match(mapComponent, /atlas-map-surface/)
  assert.match(globalCss, /\.atlas-map-surface\.maplibregl-map\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s)
})
