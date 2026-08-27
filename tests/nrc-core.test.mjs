import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

import {
  actionMatrixLabel,
  buildFindingSummary,
  findingMetricValues,
  normalizeDocket,
  parseActionMatrixWorkbook,
  parseCurrentOperatingHtml,
  parseDecommissioningWorkbook,
  parseFuelCycleHtml,
  parseOperatingWorkbook,
} from "../scripts/nrc-core.mjs"

const snapshotDirectory = resolve("data/source-snapshots/nrc-core-2026-08-26")

test("current NRC operating list provides the authoritative 95-unit status snapshot", async () => {
  const html = await readFile(resolve(snapshotDirectory, "current-operating.html"), "utf8")
  const reactors = parseCurrentOperatingHtml(html)

  assert.equal(reactors.length, 95)
  assert.deepEqual(reactors[0], {
    unitName: "Arkansas Nuclear 1",
    docketNumber: "05000313",
    licenseNumber: "DPR-51",
    reactorType: "PWR",
    location: "6 miles WNW of Russellville, AR",
    ownerOperator: "Entergy Nuclear Operations, Inc.",
    nrcRegion: "4",
  })
  assert.ok(reactors.some((reactor) => reactor.unitName === "Palisades" && reactor.docketNumber === "05000255"))
  assert.ok(reactors.some((reactor) => reactor.unitName === "Vogtle 4" && reactor.docketNumber === "05200026"))
})

test("reactor demographics remain a separate, older source with 2022 field dates", async () => {
  const reactors = await parseOperatingWorkbook(resolve(snapshotDirectory, "reactors-operating.xlsx"))

  assert.equal(reactors.length, 93)
  assert.equal(reactors[0].sourceYear, "2022")
  assert.equal(reactors[0].docketNumber, "05000313")
  assert.equal(reactors[0].netCapacityMw, 833)
  assert.equal(reactors[0].thermalCapacityMw, 2568)
  assert.equal(reactors[0].commercialOperation, "1974-12-19")
})

test("former reactor workbook yields 35 decommissioning records without inventing dates", async () => {
  const reactors = await parseDecommissioningWorkbook(resolve(snapshotDirectory, "reactors-decommissioning.xlsx"))

  assert.equal(reactors.length, 35)
  assert.equal(reactors[0].unitName, "Big Rock Point")
  assert.equal(reactors[0].shutdownDate, "1997-08-29")
  assert.equal(reactors[0].licenseTerminationTarget, "")
  assert.equal(reactors[1].licenseTerminationTarget, "2074")
  assert.equal(reactors.find((reactor) => reactor.unitName === "Three Mile Island 1")?.docketNumber, "05000289")
  assert.ok(reactors.every((reactor) => /^(?:040|050|052|070)\d{5}$/.test(reactor.docketNumber)))
})

test("NRC fuel-cycle page uses the current 12-row facility table and joins available map coordinates", async () => {
  const html = await readFile(resolve(snapshotDirectory, "fuel-cycle.html"), "utf8")
  const facilities = parseFuelCycleHtml(html)

  assert.equal(facilities.length, 12)
  assert.ok(facilities.some((facility) => facility.name === "Orano Enrichment USA" && facility.docketNumber === "07007038"))
  assert.ok(!facilities.some((facility) => facility.name === "Eagle Rock"), "stale embedded map features must not override the current facility table")
  assert.deepEqual(facilities.find((facility) => facility.name === "TRISO-X"), {
    name: "TRISO-X",
    location: "Oak Ridge, TN",
    facilityType: "Uranium Fuel Fabrication Facility",
    docketNumber: "07007027",
    latitude: 35.961388888889,
    longitude: -84.370277777778,
    pagePath: "/info-finder/fc/triso-x.html#panel216",
  })
})

test("Action Matrix parsing preserves the latest public quarter and neutral labels", async () => {
  const snapshot = await parseActionMatrixWorkbook(resolve(snapshotDirectory, "action-matrix.xlsx"))

  assert.equal(snapshot.quarter, "2025Q1")
  assert.equal(snapshot.byUnit.size, 95)
  assert.equal(snapshot.byUnit.get("Arkansas Nuclear 1"), 1)
  assert.equal(actionMatrixLabel(1), "Licensee Response Column")
  assert.equal(actionMatrixLabel(2), "Regulatory Response Column")
  assert.equal(actionMatrixLabel(null), "Not available")
})

test("public finding summaries use the last complete year and distinguish zero from unavailable", async () => {
  const summary = await buildFindingSummary(resolve(snapshotDirectory, "findings-violations.xlsx"), { year: 2024, coveredDockets: ["05099999"] })

  assert.equal(summary.year, 2024)
  assert.ok(summary.byDocket.size > 80)
  const limerick = summary.byDocket.get("05000352")
  assert.ok(limerick.total > 0)
  assert.ok(limerick.greaterThanGreen >= 0)
  assert.ok(limerick.latestIssueDate.startsWith("2024-"))
  assert.equal(summary.byDocket.get("not-a-docket"), undefined)
  assert.deepEqual(summary.byDocket.get("05099999"), { total: 0, greaterThanGreen: 0, latestIssueDate: "" })
  assert.deepEqual(findingMetricValues(undefined), { publicFindingCount: "", greaterThanGreenCount: "", latestFindingDate: "" })
  assert.deepEqual(findingMetricValues({ total: 0, greaterThanGreen: 0, latestIssueDate: "" }), { publicFindingCount: 0, greaterThanGreenCount: 0, latestFindingDate: "" })
})

test("NRC docket normalization retains eight-digit authority identifiers", () => {
  assert.equal(normalizeDocket("50-313"), "05000313")
  assert.equal(normalizeDocket("05000313"), "05000313")
  assert.equal(normalizeDocket("05200026"), "05200026")
  assert.equal(normalizeDocket("050000289"), "05000289", "the NRC former-reactor workbook contains this documented TMI-1 typo")
  assert.equal(normalizeDocket("0'5000529"), "05000529", "the NRC operating workbook contains this documented Palo Verde 2 typo")
  assert.equal(normalizeDocket("050123456"), "")
  assert.equal(normalizeDocket("05000313x"), "")
  assert.equal(normalizeDocket("docket 05000313"), "")
  assert.equal(normalizeDocket("05000-313"), "")
  assert.equal(normalizeDocket(50313), "05000313")
  assert.equal(normalizeDocket(""), "")
})
