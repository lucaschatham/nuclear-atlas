import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import ExcelJS from "exceljs"

import { buildAtlasRelease, readWorkbookTables, requiredHeaders } from "./import-atlas-workbook.mjs"
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
} from "./nrc-core.mjs"

const root = resolve(fileURLToPath(new URL("../", import.meta.url)))
const snapshotDirectory = resolve(root, "data/source-snapshots/nrc-core-2026-08-26")
const baseWorkbookPath = resolve(root, "data/releases/atlas-release.xlsx")
const positionalArguments = process.argv.slice(2).filter((argument) => !argument.startsWith("--"))
const candidateWorkbookPath = resolve(positionalArguments[0] ?? "/tmp/atlas-release-nrc-core.xlsx")
const payloadPath = resolve(positionalArguments[1] ?? "/tmp/nrc-core-sheet-payload.json")
const reportPath = resolve(positionalArguments[2] ?? "/tmp/nrc-core-reconciliation.json")
const approvalRequested = process.argv.includes("--approve")
const retrievedAtUtc = "2026-08-26T23:50:00Z"
const sourceCutoffUtc = retrievedAtUtc

const stateCentroids = {
  AL: [32.8067, -86.7911], AR: [34.9697, -92.3731], AZ: [33.7298, -111.4312], CA: [36.1162, -119.6816],
  CO: [39.0598, -105.3111], CT: [41.5978, -72.7554], DE: [39.3185, -75.5071], FL: [27.7663, -81.6868],
  GA: [33.0406, -83.6431], IA: [42.0115, -93.2105], ID: [44.2405, -114.4788], IL: [40.3495, -88.9861],
  KS: [38.5266, -96.7265], LA: [31.1695, -91.8678], MA: [42.2302, -71.5301], MD: [39.0639, -76.8021],
  ME: [44.6939, -69.3819], MI: [43.3266, -84.5361], MN: [45.6945, -93.9002], MO: [38.4561, -92.2884],
  MS: [32.7416, -89.6787], NC: [35.6301, -79.8064], NE: [41.1254, -98.2681], NH: [43.4525, -71.5639],
  NJ: [40.2989, -74.521], NM: [34.8405, -106.2485], NY: [42.1657, -74.9481], OH: [40.3888, -82.7649],
  OR: [44.572, -122.0709], PA: [40.5908, -77.2098], SC: [33.8569, -80.945], TN: [35.7478, -86.6923],
  SD: [44.2998, -99.4388],
  TX: [31.0545, -97.5635], UT: [40.15, -111.8624], VA: [37.7693, -78.17], VT: [44.0459, -72.7107],
  WA: [47.4009, -121.4905], WI: [44.2685, -89.6165],
}

const stateNames = {
  AL: "Alabama", AR: "Arkansas", AZ: "Arizona", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  FL: "Florida", GA: "Georgia", IA: "Iowa", ID: "Idaho", IL: "Illinois", KS: "Kansas", LA: "Louisiana",
  MA: "Massachusetts", MD: "Maryland", ME: "Maine", MI: "Michigan", MN: "Minnesota", MO: "Missouri",
  MS: "Mississippi", NC: "North Carolina", NE: "Nebraska", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", OH: "Ohio", OR: "Oregon", PA: "Pennsylvania", SC: "South Carolina", TN: "Tennessee",
  SD: "South Dakota",
  TX: "Texas", UT: "Utah", VA: "Virginia", VT: "Vermont", WA: "Washington", WI: "Wisconsin",
}

const fuelDockets = {
  "Eagle Rock": "07007015",
  Framatome: "07001257",
  BWXT: "07000027",
  "Global Laser Enrichment (GLE)": "07007016",
  "GNF-A": "07001113",
  Honeywell: "04003392",
  "International Isotopes": "04009086",
  NFS: "07000143",
  "Louisiana Energy Services (LES)": "07003103",
  "American Centrifuge Plant (ACP)": "07007004",
  Westinghouse: "07001151",
  "TRISO-X": "07007027",
}

const preservedFuelIds = {
  Honeywell: ["fuel_honeywell_metropolis", "site_metropolis"],
  "Louisiana Energy Services (LES)": ["fuel_les_eunice", "site_eunice"],
  BWXT: ["fuel_bwxt_lynchburg", "site_lynchburg"],
  Westinghouse: ["fuel_westinghouse_columbia", "site_columbia_sc"],
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function slug(value) {
  return String(value).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
}

function normalizeName(value) {
  return slug(String(value).replace(/\b(nuclear|power|generating|station|plant|facility)\b/gi, " ")).replaceAll("_", "")
}

function baseUnitName(value) {
  return String(value)
    .replace(/,?\s+Unit\s+\d+$/i, "")
    .replace(/\s+Units?\s+\d+(?:\s+and\s+\d+)?$/i, "")
    .replace(/\s+\d+$/i, "")
    .trim()
}

function stateCodeFromLocation(value) {
  const matches = [...String(value).matchAll(/\b([A-Z]{2})\b/gi)]
    .map((match) => match[1].toUpperCase())
    .filter((code) => stateCentroids[code])
  return matches.at(-1) ?? ""
}

function localityFromLocation(value) {
  const direct = String(value).match(/(?:of\s+)?([^,()]+),\s*[A-Z]{2}(?:\b|\))/i)?.[1] ?? ""
  return direct.replace(/^\d+(?:\.\d+)?\s+miles?\s+[A-Z]+\s+of\s+/i, "").trim()
}

function upsert(rows, key, record) {
  const index = rows.findIndex((row) => String(row[key]) === String(record[key]))
  if (index >= 0) rows[index] = { ...rows[index], ...record }
  else rows.push(record)
  return record
}

function sourceRecord(id, name, url, asOf, notes) {
  return {
    source_id: id,
    publisher: "U.S. Nuclear Regulatory Commission",
    source_name: name,
    authority_class: "official_regulatory",
    source_url: url,
    terms_url: "https://www.nrc.gov/about-nrc/regulatory/rulemaking/accessibility.html",
    reuse_status: "approved_factual_reuse",
    geographic_scope: "United States",
    source_as_of: asOf,
    retrieved_at_utc: retrievedAtUtc,
    notes,
  }
}

async function readDynamicTables(path) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path)
  const tables = {}
  for (const sheet of workbook.worksheets) {
    const headers = sheet.getRow(1).values.slice(1).map((value) => String(value ?? ""))
    const rows = []
    for (let rowIndex = 2; rowIndex <= sheet.actualRowCount; rowIndex += 1) {
      const values = headers.map((_, index) => sheet.getRow(rowIndex).getCell(index + 1).value ?? "")
      if (values.every((value) => value === "")) continue
      rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index]])))
    }
    tables[sheet.name] = rows
  }
  return { workbook, tables }
}

function locationForSite(site, fallbackStateCode) {
  if (site?.latitude !== "" && site?.longitude !== "" && site?.latitude !== undefined && site?.longitude !== undefined) {
    return {
      latitude: Number(site.latitude),
      longitude: Number(site.longitude),
      precision: site.location_precision || "region",
      label: site.site_name,
      note: site.notes || "Public location at the stated precision.",
    }
  }
  const [latitude, longitude] = stateCentroids[fallbackStateCode] ?? []
  return {
    latitude: latitude ?? "",
    longitude: longitude ?? "",
    precision: "state",
    label: stateNames[fallbackStateCode] ? `${stateNames[fallbackStateCode]}, United States` : "United States",
    note: "State centroid used for map placement. The source names the reactor and state but does not provide a machine-readable site coordinate.",
  }
}

function fuelCycleStage(type) {
  const normalized = type.toLowerCase()
  if (normalized.includes("deconversion")) return "deconversion"
  if (normalized.includes("conversion")) return "conversion"
  if (normalized.includes("enrichment") || normalized.includes("separation")) return "enrichment"
  if (normalized.includes("fabrication")) return "fuel_fabrication"
  return "other"
}

function citation(id, table, recordId, sourceId, locator, supportsFields, sourceDateOriginal, effectiveDate = sourceDateOriginal) {
  return {
    citation_id: id,
    record_table: table,
    record_id: recordId,
    source_id: sourceId,
    source_record_id: locator,
    locator,
    supports_fields: supportsFields,
    source_date_original: sourceDateOriginal,
    source_date_precision: /^\d{4}$/.test(sourceDateOriginal) ? "year" : /^\d{4}Q\d$/.test(sourceDateOriginal) ? "quarter" : "day",
    effective_date: effectiveDate,
    retrieved_at_utc: retrievedAtUtc,
    review_status: "approved",
  }
}

function duplicateValues(rows, key) {
  const seen = new Set()
  const duplicates = new Set()
  for (const row of rows) {
    if (!row[key]) continue
    if (seen.has(row[key])) duplicates.add(row[key])
    seen.add(row[key])
  }
  return [...duplicates]
}

async function writeCandidateWorkbook(sourceWorkbook, tables, outputPath) {
  const templates = {}
  for (const sheet of sourceWorkbook.worksheets) {
    templates[sheet.name] = Array.from({ length: Math.max(sheet.actualColumnCount, requiredHeaders[sheet.name]?.length ?? 0) }, (_, index) => {
      const cell = sheet.getRow(2).getCell(index + 1)
      return { style: clone(cell.style) ?? {}, dataValidation: clone(cell.dataValidation), numFmt: cell.numFmt }
    })
  }

  for (const [sheetName, headers] of Object.entries(requiredHeaders)) {
    const sheet = sourceWorkbook.getWorksheet(sheetName)
    if (!sheet) throw new Error(`Candidate workbook is missing ${sheetName}`)
    sheet.getRow(1).values = headers
    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) sheet.getRow(rowIndex).values = []
    for (const [index, record] of tables[sheetName].entries()) {
      const row = sheet.getRow(index + 2)
      row.values = headers.map((header) => record[header] ?? "")
      row.height = 30
      for (let column = 1; column <= headers.length; column += 1) {
        const template = templates[sheetName]?.[column - 1]
        if (!template) continue
        row.getCell(column).style = clone(template.style)
        row.getCell(column).dataValidation = clone(template.dataValidation)
        row.getCell(column).numFmt = template.numFmt
      }
    }
  }
  await sourceWorkbook.xlsx.writeFile(outputPath)
}

async function main() {
  const manifest = JSON.parse(await readFile(resolve(snapshotDirectory, "manifest.json"), "utf8"))
  if (manifest.retrieved_at_utc !== retrievedAtUtc) throw new Error("Snapshot manifest retrieval time changed")
  for (const source of manifest.sources) {
    const body = await readFile(resolve(snapshotDirectory, source.file))
    const sha256 = createHash("sha256").update(body).digest("hex")
    if (sha256 !== source.sha256) throw new Error(`${source.file} failed SHA-256 verification`)
    if (source.bytes !== undefined && body.byteLength !== source.bytes) throw new Error(`${source.file} byte count changed: expected ${source.bytes}, received ${body.byteLength}`)
  }

  const operatingHtml = await readFile(resolve(snapshotDirectory, "current-operating.html"), "utf8")
  const fuelHtml = await readFile(resolve(snapshotDirectory, "fuel-cycle.html"), "utf8")
  const operatingUnits = parseCurrentOperatingHtml(operatingHtml)
  const demographics = await parseOperatingWorkbook(resolve(snapshotDirectory, "reactors-operating.xlsx"))
  const formerReactors = await parseDecommissioningWorkbook(resolve(snapshotDirectory, "reactors-decommissioning.xlsx"))
  const fuelFacilities = parseFuelCycleHtml(fuelHtml)
  const actionMatrix = await parseActionMatrixWorkbook(resolve(snapshotDirectory, "action-matrix.xlsx"))
  const findingSummary = await buildFindingSummary(resolve(snapshotDirectory, "findings-violations.xlsx"), {
    year: 2024,
    coveredDockets: operatingUnits.map((unit) => unit.docketNumber),
  })

  if (operatingUnits.length !== 95 || demographics.length !== 93 || formerReactors.length !== 35 || fuelFacilities.length !== 12 || actionMatrix.byUnit.size !== 95) {
    throw new Error(`Unexpected NRC source counts: ${operatingUnits.length} operating, ${demographics.length} demographics, ${formerReactors.length} former, ${fuelFacilities.length} fuel, ${actionMatrix.byUnit.size} Action Matrix`)
  }
  for (const [label, rows, key] of [["operating units", operatingUnits, "docketNumber"], ["operating demographics", demographics, "docketNumber"], ["former reactors", formerReactors, "docketNumber"]]) {
    const duplicates = duplicateValues(rows, key)
    if (duplicates.length) throw new Error(`${label} contain duplicate dockets: ${duplicates.join(", ")}`)
  }
  for (const code of actionMatrix.byUnit.values()) {
    if (code !== null && ![1, 2, 3, 4, 5].includes(code)) throw new Error(`Action Matrix contains unsupported code ${code}`)
  }

  const { workbook, tables } = await readDynamicTables(baseWorkbookPath)
  for (const tableName of Object.keys(requiredHeaders)) tables[tableName] ??= []

  upsert(tables.SOURCES, "source_id", sourceRecord("src_nrc_operating_units", "List of Power Reactor Units", "https://www.nrc.gov/reactors/operating/list-power-reactor-units", "2026-08-26", "Current operating membership, docket, license, reactor type, public location, operator, and NRC region for 95 units."))
  upsert(tables.SOURCES, "source_id", sourceRecord("src_nrc_reactor_demographics_2022", "Power Reactors", "https://www.nrc.gov/sites/default/files/doc_library/cdn/legacy/reading-rm/doc-collections/datasets/reactors-operating.xlsx", "2022", "Frozen technical and historical attributes for 93 units. Current status comes from the current operating-unit page."))
  upsert(tables.SOURCES, "source_id", sourceRecord("src_nrc_decommissioning_demographics_2022", "Power Reactors Formerly Licensed to Operate", "https://www.nrc.gov/sites/default/files/doc_library/cdn/legacy/reading-rm/doc-collections/datasets/reactors-decommissioning.xlsx", "2022", "Frozen shutdown, strategy, phase, and license-termination fields for 35 formerly licensed units."))
  upsert(tables.SOURCES, "source_id", sourceRecord("src_nrc_action_matrix_2025q1", "Reactor Oversight Process Action Matrix", "https://www.nrc.gov/reactors/operating/oversight/actionmatrix-summary", "2025Q1", "Latest quarter in the frozen NRC Action Matrix dataset. Categories state the NRC oversight response, not a safety score."))
  upsert(tables.SOURCES, "source_id", sourceRecord("src_nrc_findings_2024", "Reactor Inspection Findings and Violations", "https://www.nrc.gov/reactors/operating/oversight/inspection-findings-search-dashboard", "2025-05-13", "Count of public rows in the frozen NRC dataset for calendar year 2024. Zero means no public row for that docket in this snapshot, not proof that no inspection issue existed. Security finding details are withheld."))
  upsert(tables.SOURCES, "source_id", sourceRecord("src_nrc_fuel_cycle", "Locations of Fuel Cycle Facilities", "https://www.nrc.gov/info-finder/fc/index", "2026-06-18", "Current NRC facility table for 12 fuel-cycle facilities, joined to embedded map coordinates when the facility identity matches."))

  const demographicsByDocket = new Map(demographics.map((record) => [record.docketNumber, record]))
  const reactorByDocket = new Map(tables.REACTORS.filter((record) => record.authority_id).map((record) => [normalizeDocket(record.authority_id), record]))
  const siteById = new Map(tables.SITES.map((site) => [String(site.site_id), site]))
  const siteByDocket = new Map(tables.SITES.filter((site) => site.nrc_docket).map((site) => [normalizeDocket(site.nrc_docket), site]))
  const actionByNormalizedName = new Map([...actionMatrix.byUnit].map(([name, code]) => [normalizeName(name), code]))
  actionByNormalizedName.set(normalizeName("Shearon Harris 1"), actionMatrix.byUnit.get("Harris 1") ?? null)
  const generatedOperations = []
  const generatedOperationCitations = []
  const siteIdByBase = new Map()
  let approximateOperatingLocations = 0
  let missingDemographics = 0
  let missingActionMatrix = 0

  for (const unit of operatingUnits) {
    const demographic = demographicsByDocket.get(unit.docketNumber)
    if (!demographic) missingDemographics += 1
    const existingReactor = reactorByDocket.get(unit.docketNumber)
    const baseName = baseUnitName(unit.unitName)
    const stateCode = stateCodeFromLocation(unit.location)
    let siteId = existingReactor?.site_id || siteByDocket.get(unit.docketNumber)?.site_id || siteIdByBase.get(`${normalizeName(baseName)}:${stateCode}`)
    if (!siteId) {
      const matchingSite = tables.SITES.find((site) => {
        const sameState = !stateCode || site.admin1 === stateNames[stateCode]
        return sameState && (normalizeName(site.site_name).includes(normalizeName(baseName)) || normalizeName(baseName).includes(normalizeName(site.site_name)))
      })
      siteId = matchingSite?.site_id || `site_nrc_${slug(baseName)}_${stateCode.toLowerCase()}`
    }
    siteIdByBase.set(`${normalizeName(baseName)}:${stateCode}`, siteId)
    let site = siteById.get(siteId)
    if (!site) {
      const [latitude, longitude] = stateCentroids[stateCode] ?? ["", ""]
      site = upsert(tables.SITES, "site_id", {
        site_id: siteId, site_name: baseName, aliases: "", country_code: "US", country_name: "United States",
        admin1: stateNames[stateCode] ?? "", locality: localityFromLocation(unit.location), latitude, longitude,
        location_precision: "state", site_category: "power_reactor", public_status: "operating", nrc_docket: unit.docketNumber,
        eia_plant_id: "", notes: "State centroid used for map placement because the NRC unit list does not provide a machine-readable site coordinate.",
      })
      siteById.set(siteId, site)
    }
    const location = locationForSite(site, stateCode)
    if (location.precision !== "site") approximateOperatingLocations += 1
    const reactorId = existingReactor?.reactor_id || `reactor_nrc_${unit.docketNumber}`
    const reactor = upsert(tables.REACTORS, "reactor_id", {
      reactor_id: reactorId, site_id: siteId, unit_name: unit.unitName, reactor_type: unit.reactorType,
      reactor_model: demographic?.reactorModel ?? "", technology: "large_lwr",
      owner_name: unit.ownerOperator, operator_name: unit.ownerOperator,
      net_capacity_mw: demographic?.netCapacityMw ?? "", gross_capacity_mw: "", thermal_capacity_mw: demographic?.thermalCapacityMw ?? "",
      construction_start: demographic?.constructionStart ?? "", first_criticality: "", grid_connection: "",
      commercial_operation: demographic?.commercialOperation ?? "", permanent_shutdown: "", operating_status: "operating",
      status_as_of: "2026-08-26", authority_id: unit.docketNumber, review_status: "approved",
    })
    reactorByDocket.set(unit.docketNumber, reactor)

    const actionCode = actionMatrix.byUnit.get(unit.unitName) ?? actionByNormalizedName.get(normalizeName(unit.unitName)) ?? null
    if (actionCode === null) missingActionMatrix += 1
    const finding = findingSummary.byDocket.get(unit.docketNumber)
    const findingMetrics = findingMetricValues(finding)
    const operationId = `ops_nrc_${unit.docketNumber}_2025q1`
    generatedOperations.push({
      operation_id: operationId, reactor_id: reactorId, site_id: siteId, reactor_name: unit.unitName,
      period_start: "2024-01-01", period_end: "2024-12-31", period_frequency: "annual", operating_status: "operating",
      net_generation_mwh: "", capacity_factor_pct: "", outage_mw: "", outage_type: "unknown",
      action_matrix_period: actionMatrix.quarter, action_matrix_code: actionCode ?? "", action_matrix_label: actionMatrixLabel(actionCode),
      public_findings_period: finding ? "2024" : "", public_finding_count: findingMetrics.publicFindingCount,
      greater_than_green_count: findingMetrics.greaterThanGreenCount, latest_finding_date: findingMetrics.latestFindingDate,
      status_as_of: "2026-08-26",
      latitude: location.latitude, longitude: location.longitude, location_precision: location.precision,
      location_label: location.label, coordinate_note: location.note, review_status: "approved",
    })
    generatedOperationCitations.push(citation(`cite_nrc_core_ops_current_${unit.docketNumber}`, "OPERATIONS", operationId, "src_nrc_operating_units", `Docket ${unit.docketNumber}; ${unit.unitName}`, "reactor_name,operating_status,status_as_of,location_label,location_precision", "2026-08-26"))
    if (demographic) generatedOperationCitations.push(citation(`cite_nrc_core_ops_demo_${unit.docketNumber}`, "OPERATIONS", operationId, "src_nrc_reactor_demographics_2022", `Docket ${unit.docketNumber}; ${demographic.unitName}`, "reactor_type,reactor_model,net_capacity_mw,thermal_capacity_mw,construction_start,commercial_operation", "2022"))
    if (actionCode !== null) generatedOperationCitations.push(citation(`cite_nrc_core_ops_action_${unit.docketNumber}`, "OPERATIONS", operationId, "src_nrc_action_matrix_2025q1", `${actionMatrix.quarter}; ${unit.unitName}`, "action_matrix_period,action_matrix_code,action_matrix_label", actionMatrix.quarter))
    if (finding) generatedOperationCitations.push(citation(`cite_nrc_core_ops_findings_${unit.docketNumber}`, "OPERATIONS", operationId, "src_nrc_findings_2024", `Docket ${unit.docketNumber}; calendar year 2024`, "public_findings_period,public_finding_count,greater_than_green_count,latest_finding_date", "2025-05-13", "2024"))
  }

  tables.CITATIONS = tables.CITATIONS.filter((record) => record.record_table !== "OPERATIONS" && record.record_table !== "FUEL_SUPPLY")
  tables.OPERATIONS = generatedOperations
  tables.CITATIONS.push(...generatedOperationCitations)

  tables.FUEL_SUPPLY = []
  for (const facility of fuelFacilities) {
    const [facilityId, preservedSiteId] = preservedFuelIds[facility.name] ?? [`fuel_nrc_${slug(facility.name)}`, `site_fuel_${slug(facility.name)}`]
    const docketNumber = normalizeDocket(facility.docketNumber || fuelDockets[facility.name] || "")
    const stateCode = stateCodeFromLocation(facility.location)
    const locality = facility.location.split(",")[0].trim()
    const siteId = preservedSiteId
    const hasMapCoordinates = Number.isFinite(facility.latitude) && Number.isFinite(facility.longitude)
    const [fallbackLatitude, fallbackLongitude] = stateCentroids[stateCode] ?? ["", ""]
    const latitude = hasMapCoordinates ? facility.latitude : fallbackLatitude
    const longitude = hasMapCoordinates ? facility.longitude : fallbackLongitude
    const locationPrecision = hasMapCoordinates ? "region" : "state"
    const coordinateNote = hasMapCoordinates
      ? "Coordinate published in the NRC fuel-cycle map. The map does not characterize coordinate precision."
      : "State centroid used for map placement because the current NRC facility table does not provide a machine-readable coordinate."
    upsert(tables.SITES, "site_id", {
      site_id: siteId, site_name: facility.name, aliases: "", country_code: "US", country_name: "United States",
      admin1: stateNames[stateCode] ?? "", locality, latitude, longitude,
      location_precision: locationPrecision, site_category: "fuel_cycle", public_status: "listed_by_nrc", nrc_docket: docketNumber,
      eia_plant_id: "", notes: coordinateNote,
    })
    tables.FUEL_SUPPLY.push({
      facility_id: facilityId, site_id: siteId, facility_name: facility.name, fuel_cycle_stage: fuelCycleStage(facility.facilityType),
      material_or_product: facility.facilityType, status: "listed_by_nrc", capacity_value: "", capacity_unit: "", capacity_basis: "",
      docket_number: docketNumber, status_as_of: "2026-06-18", latitude, longitude,
      location_precision: locationPrecision, location_label: facility.location,
      coordinate_note: coordinateNote, review_status: "approved",
    })
    const coordinateFields = hasMapCoordinates ? ",latitude,longitude" : ""
    tables.CITATIONS.push(citation(`cite_nrc_core_fuel_${slug(facility.name)}`, "FUEL_SUPPLY", facilityId, "src_nrc_fuel_cycle", facility.pagePath || facility.name, `facility_name,fuel_cycle_stage,material_or_product,status,docket_number,location_label,location_precision${coordinateFields}`, "2026-06-18"))
  }

  const existingDecomDockets = new Set(tables.DECOMMISSIONING.flatMap((record) => {
    const reactor = tables.REACTORS.find((candidate) => candidate.reactor_id === record.reactor_id)
    return String(reactor?.authority_id ?? "").split(/[;,]/).map(normalizeDocket)
  }).filter(Boolean))
  let addedDecommissioning = 0
  for (const former of formerReactors) {
    if (existingDecomDockets.has(former.docketNumber)) continue
    const baseName = baseUnitName(former.unitName)
    const stateCode = stateCodeFromLocation(former.location)
    const existingReactor = reactorByDocket.get(former.docketNumber)
    let siteId = existingReactor?.site_id || siteByDocket.get(former.docketNumber)?.site_id
    if (!siteId) {
      const matchingSite = tables.SITES.find((site) => site.admin1 === stateNames[stateCode] && (normalizeName(site.site_name).includes(normalizeName(baseName)) || normalizeName(baseName).includes(normalizeName(site.site_name))))
      siteId = matchingSite?.site_id || `site_nrc_${slug(baseName)}_${stateCode.toLowerCase()}`
    }
    let site = tables.SITES.find((candidate) => candidate.site_id === siteId)
    if (!site) {
      const [latitude, longitude] = stateCentroids[stateCode] ?? ["", ""]
      site = upsert(tables.SITES, "site_id", {
        site_id: siteId, site_name: baseName, aliases: "", country_code: "US", country_name: "United States",
        admin1: stateNames[stateCode] ?? "", locality: localityFromLocation(former.location), latitude, longitude,
        location_precision: "state", site_category: "power_reactor", public_status: "decommissioning", nrc_docket: former.docketNumber,
        eia_plant_id: "", notes: "State centroid used for map placement because the NRC workbook does not provide a machine-readable site coordinate.",
      })
    }
    const location = locationForSite(site, stateCode)
    const reactorId = existingReactor?.reactor_id || `reactor_nrc_${former.docketNumber}`
    upsert(tables.REACTORS, "reactor_id", {
      reactor_id: reactorId, site_id: siteId, unit_name: former.unitName, reactor_type: former.reactorType, reactor_model: former.reactorModel,
      technology: "large_lwr", owner_name: "", operator_name: "", net_capacity_mw: "", gross_capacity_mw: "",
      thermal_capacity_mw: former.thermalCapacityMw ?? "", construction_start: "", first_criticality: "", grid_connection: "",
      commercial_operation: "", permanent_shutdown: former.shutdownDate, operating_status: "decommissioning",
      status_as_of: "2022", authority_id: former.docketNumber, review_status: "approved",
    })
    const decomId = `decom_nrc_${former.docketNumber}`
    tables.DECOMMISSIONING.push({
      decom_id: decomId, site_id: siteId, reactor_id: reactorId, facility_name: former.unitName, strategy: former.strategy,
      current_phase: former.currentPhase, shutdown_date: former.shutdownDate, license_termination_target: former.licenseTerminationTarget,
      estimated_cost: "", estimated_cost_currency: "", trust_fund_balance: "", trust_fund_date: "", status_as_of: "2022",
      latitude: location.latitude, longitude: location.longitude, location_precision: location.precision, location_label: location.label,
      coordinate_note: location.note, review_status: "approved",
    })
    tables.CITATIONS.push(citation(`cite_nrc_core_decom_${former.docketNumber}`, "DECOMMISSIONING", decomId, "src_nrc_decommissioning_demographics_2022", `Docket ${former.docketNumber}; ${former.unitName}`, "facility_name,strategy,current_phase,shutdown_date,license_termination_target,status_as_of", "2022"))
    addedDecommissioning += 1
  }

  tables.RELEASE = [{
    release_id: "release_2026-08-26_v2", schema_version: 2, source_cutoff_utc: sourceCutoffUtc, generated_at_utc: retrievedAtUtc,
    canonical_model_sha256: "", review_status: approvalRequested ? "approved" : "draft", approved_by: approvalRequested ? "Lucas Chatham" : "",
    notes: "Static U.S. NRC snapshot adding 95 current reactor units, 2024 public oversight aggregates, 12 fuel-cycle facilities, and formerly licensed reactor records.",
  }]

  for (const [tableName, rows] of Object.entries(tables)) {
    const id = requiredHeaders[tableName]?.[0]
    if (id) rows.sort((left, right) => String(left[id] ?? "").localeCompare(String(right[id] ?? "")))
  }

  await writeCandidateWorkbook(workbook, tables, candidateWorkbookPath)
  const candidateTables = await readWorkbookTables(candidateWorkbookPath)
  const release = buildAtlasRelease(candidateTables, "pending")
  const candidateWorkbook = new ExcelJS.Workbook()
  await candidateWorkbook.xlsx.readFile(candidateWorkbookPath)
  candidateWorkbook.getWorksheet("RELEASE").getCell("E2").value = release.canonicalModelSha256
  await candidateWorkbook.xlsx.writeFile(candidateWorkbookPath)
  const finalTables = await readWorkbookTables(candidateWorkbookPath)
  buildAtlasRelease(finalTables, "pending")

  const payload = Object.fromEntries(Object.entries(requiredHeaders).map(([sheetName, headers]) => [
    sheetName,
    [headers, ...finalTables[sheetName].map((record) => headers.map((header) => record[header] ?? ""))],
  ]))
  await writeFile(payloadPath, `${JSON.stringify(payload)}\n`)

  const canonicalJson = JSON.stringify(finalTables)
  const report = {
    snapshotId: manifest.snapshot_id,
    approvalRequested,
    counts: {
      currentOperatingUnits: operatingUnits.length,
      demographicUnits: demographics.length,
      formerlyLicensedUnits: formerReactors.length,
      fuelCycleFacilities: fuelFacilities.length,
      actionMatrixUnits: actionMatrix.byUnit.size,
      operationsPublished: finalTables.OPERATIONS.length,
      decommissioningPublished: finalTables.DECOMMISSIONING.length,
      reactorsTotal: finalTables.REACTORS.length,
      sitesTotal: finalTables.SITES.length,
      sourcesTotal: finalTables.SOURCES.length,
      citationsTotal: finalTables.CITATIONS.length,
    },
    reconciliation: {
      missingDemographics,
      missingActionMatrix,
      approximateOperatingLocations,
      addedDecommissioning,
      duplicateCurrentDockets: duplicateValues(operatingUnits, "docketNumber"),
    },
    canonicalModelSha256: finalTables.RELEASE[0].canonical_model_sha256,
    normalizedTablesSha256: createHash("sha256").update(canonicalJson).digest("hex"),
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
  console.log(`Candidate workbook: ${candidateWorkbookPath}`)
  console.log(`Google Sheets payload: ${payloadPath}`)
  console.log(`Reconciliation report: ${reportPath}`)
}

await main()
