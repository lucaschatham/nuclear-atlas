import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  ALL_EVIDENCE_LENS,
  atlasRecordSetKey,
  createAtlasRecords,
  createInitialAtlasState,
  filterAtlasRecords,
  locationPrecisionsForLayers,
  parseAtlasSearch,
  reduceAtlasState,
  serializeAtlasSearch,
} from "../src/lib/atlas-workspace.ts"

const root = new URL("../", import.meta.url)

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"))
}

test("atlas records preserve every deal and public location precision", async () => {
  const [deals, locations] = await Promise.all([
    readJson("data/deals.json"),
    readJson("data/atlas-locations.json"),
  ])
  const records = createAtlasRecords(deals, locations)

  assert.equal(records.length, deals.length)
  assert.deepEqual(records.map((record) => record.id).sort(), deals.map((deal) => deal.id).sort())
  assert.ok(records.every((record) => record.locationPrecision !== undefined))
  assert.ok(records.every((record) => record.sourceIds.length > 0))
})

test("map and table derive their rows from one deterministic filter", async () => {
  const [deals, locations] = await Promise.all([
    readJson("data/deals.json"),
    readJson("data/atlas-locations.json"),
  ])
  const records = createAtlasRecords(deals, locations)
  const state = createInitialAtlasState()
  const technology = records[0].technology
  const filtered = filterAtlasRecords(records, {
    ...state,
    filters: { ...state.filters, technologies: [technology] },
  })

  assert.ok(filtered.length > 0)
  assert.ok(filtered.every((record) => record.technology === technology))
  assert.deepEqual(
    filtered.map((record) => record.id),
    filterAtlasRecords(records, { ...state, view: "table", filters: { ...state.filters, technologies: [technology] } }).map((record) => record.id),
  )
})

test("workspace transitions preserve selection across map and table views", () => {
  const initial = createInitialAtlasState()
  const selected = reduceAtlasState(initial, { type: "select-record", id: "example" })
  const table = reduceAtlasState(selected, { type: "set-view", view: "table" })

  assert.equal(table.selectedRecordId, "example")
  assert.equal(table.inspector, "record")
  assert.equal(table.view, "table")
})

test("persona persistence is narrow and URL state takes precedence", () => {
  const stored = createInitialAtlasState("Fuel procurement")
  const parsed = parseAtlasSearch("?lens=Developer&stage=build-license&view=table", stored)

  assert.equal(parsed.personaLens, "Developer")
  assert.equal(parsed.lifecycleStage, "build-license")
  assert.equal(parsed.view, "table")
  assert.equal(createInitialAtlasState().personaLens, ALL_EVIDENCE_LENS)
  assert.match(serializeAtlasSearch(parsed), /lens=Developer/)
})

test("URL state round-trips filters and persona stage overrides", () => {
  const state = {
    ...createInitialAtlasState("Developer"),
    lifecycleStage: "projects",
    view: "table",
    filters: {
      query: "crane restart",
      technologies: ["restart", "smr"],
      evidenceStrengths: ["B3", "B4"],
      locationPrecisions: ["site"],
      sourceAuthorities: [],
    },
  }
  const serialized = serializeAtlasSearch(state)
  const parsed = parseAtlasSearch(`?${serialized}`, createInitialAtlasState())

  assert.equal(parsed.personaLens, "Developer")
  assert.equal(parsed.lifecycleStage, "projects")
  assert.equal(parsed.view, "table")
  assert.deepEqual(parsed.filters, state.filters)
})

test("URL precision state normalizes to supported control modes", () => {
  const mixed = parseAtlasSearch("?precision=site,state")
  const partialApproximate = parseAtlasSearch("?precision=state")

  assert.deepEqual(mixed.filters.locationPrecisions, [])
  assert.deepEqual(partialApproximate.filters.locationPrecisions, ["county", "state", "region", "country"])
  assert.deepEqual(parseAtlasSearch("?authority=official_regulatory").filters.sourceAuthorities, [])
})

test("record-set identity changes only for stages and filters", () => {
  const initial = createInitialAtlasState()
  const inspector = reduceAtlasState(initial, { type: "open-inspector", inspector: "sources" })
  const selected = reduceAtlasState(initial, { type: "select-record", id: "example" })
  const filtered = reduceAtlasState(initial, { type: "set-query", query: "crane" })

  assert.equal(atlasRecordSetKey(inspector), atlasRecordSetKey(initial))
  assert.equal(atlasRecordSetKey(selected), atlasRecordSetKey(initial))
  assert.notEqual(atlasRecordSetKey(filtered), atlasRecordSetKey(initial))
})

test("layer visibility preserves at least one location class", () => {
  assert.deepEqual(locationPrecisionsForLayers(true, true), [])
  assert.deepEqual(locationPrecisionsForLayers(true, false), ["site"])
  assert.deepEqual(locationPrecisionsForLayers(false, true), ["county", "state", "region", "country"])
  assert.equal(locationPrecisionsForLayers(false, false), null)
})

test("unsupported lifecycle stages return a coverage gap, not an empty-data claim", async () => {
  const [deals, locations] = await Promise.all([
    readJson("data/deals.json"),
    readJson("data/atlas-locations.json"),
  ])
  const records = createAtlasRecords(deals, locations)
  const state = { ...createInitialAtlasState(), lifecycleStage: "spent-fuel" }

  assert.deepEqual(filterAtlasRecords(records, state), [])
  assert.equal(state.lifecycleStage === "projects", false)
})
