import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import ExcelJS from "exceljs"

import { buildAtlasRelease, readWorkbookTables } from "./import-atlas-workbook.mjs"

const root = resolve(fileURLToPath(new URL("../", import.meta.url)))
const snapshotPath = resolve(root, "data/source-snapshots/nrc-isfsi-2024.json")
const defaultWorkbookPath = resolve(root, "data/releases/atlas-release.xlsx")
const defaultPayloadPath = "/tmp/nrc-isfsi-sheet-payload.json"

const headers = {
  RELEASE: ["release_id", "schema_version", "source_cutoff_utc", "generated_at_utc", "canonical_model_sha256", "review_status", "approved_by", "notes"],
  SOURCES: ["source_id", "publisher", "source_name", "authority_class", "source_url", "terms_url", "reuse_status", "geographic_scope", "source_as_of", "retrieved_at_utc", "notes"],
  SITES: ["site_id", "site_name", "aliases", "country_code", "country_name", "admin1", "locality", "latitude", "longitude", "location_precision", "site_category", "public_status", "nrc_docket", "eia_plant_id", "notes"],
  SPENT_FUEL: ["storage_id", "site_id", "reactor_id", "facility_name", "installation_type", "storage_method", "license_number", "license_type", "inventory_value", "inventory_unit", "inventory_date", "status", "latitude", "longitude", "location_precision", "location_label", "coordinate_note", "review_status"],
  CITATIONS: ["citation_id", "record_table", "record_id", "source_id", "source_record_id", "locator", "supports_fields", "source_date_original", "source_date_precision", "effective_date", "retrieved_at_utc", "review_status"],
}

const stateCentroids = {
  AL: [32.8067, -86.7911], AR: [34.9697, -92.3731], AZ: [33.7298, -111.4312], CA: [36.1162, -119.6816],
  CO: [39.0598, -105.3111], CT: [41.5978, -72.7554], FL: [27.7663, -81.6868], GA: [33.0406, -83.6431],
  IA: [42.0115, -93.2105], ID: [44.2405, -114.4788], IL: [40.3495, -88.9861], KS: [38.5266, -96.7265],
  LA: [31.1695, -91.8678], MA: [42.2302, -71.5301], MD: [39.0639, -76.8021], ME: [44.6939, -69.3819],
  MI: [43.3266, -84.5361], MN: [45.6945, -93.9002], MO: [38.4561, -92.2884], MS: [32.7416, -89.6787],
  NC: [35.6301, -79.8064], NE: [41.1254, -98.2681], NH: [43.4525, -71.5639], NJ: [40.2989, -74.521],
  NM: [34.8405, -106.2485], NY: [42.1657, -74.9481], OH: [40.3888, -82.7649], OR: [44.572, -122.0709],
  PA: [40.5908, -77.2098], SC: [33.8569, -80.945], TN: [35.7478, -86.6923], TX: [31.0545, -97.5635],
  UT: [40.15, -111.8624], VA: [37.7693, -78.17], VT: [44.0459, -72.7107], WA: [47.4009, -121.4905],
  WI: [44.2685, -89.6165],
}

const existingSiteIds = {
  "Clinton": "site_clinton",
  "Columbia": "site_columbia",
  "Diablo Canyon": "site_diablo_canyon",
  "Fermi 2": "site_fermi",
  "Indian Point": "site_indian_point",
  "Kewaunee": "site_kewaunee",
  "North Anna": "site_north_anna",
  "Pilgrim": "site_pilgrim",
  "San Onofre": "site_san_onofre",
  "Susquehanna": "site_susquehanna",
  "Turkey Point": "site_turkey_point",
  "Vogtle": "site_vogtle",
}

const existingStorageIds = {
  "Indian Point": "spent_indian_point_isfsi",
  "Pilgrim": "spent_pilgrim_isfsi",
  "San Onofre": "spent_san_onofre_isfsi",
}

function slug(value) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function rowsByHeader(sheet, keys) {
  const rows = []
  for (let rowIndex = 2; rowIndex <= sheet.actualRowCount; rowIndex += 1) {
    const values = keys.map((_, index) => sheet.getRow(rowIndex).getCell(index + 1).value ?? "")
    if (values.every((value) => value === "")) continue
    rows.push(Object.fromEntries(keys.map((key, index) => [key, values[index]])))
  }
  return rows
}

function appendStructuredRow(sheet, keys, record) {
  const exemplar = sheet.getRow(2)
  let lastDataRow = 1
  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
    if (String(sheet.getRow(rowIndex).getCell(1).value ?? "").trim()) lastDataRow = rowIndex
  }
  const row = sheet.getRow(lastDataRow + 1)
  row.values = keys.map((key) => record[key] ?? "")
  row.height = exemplar.height
  for (let index = 1; index <= keys.length; index += 1) {
    const source = exemplar.getCell(index)
    const target = row.getCell(index)
    target.style = clone(source.style) ?? {}
    target.dataValidation = clone(source.dataValidation)
    target.numFmt = source.numFmt
  }
  return row
}

function clearRowsById(sheet, ids) {
  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
    if (ids.has(String(sheet.getRow(rowIndex).getCell(1).value ?? ""))) sheet.getRow(rowIndex).values = []
  }
}

function findRow(sheet, keys, key, value) {
  const column = keys.indexOf(key) + 1
  for (let rowIndex = 2; rowIndex <= sheet.actualRowCount; rowIndex += 1) {
    if (String(sheet.getRow(rowIndex).getCell(column).value ?? "") === value) return sheet.getRow(rowIndex)
  }
  return null
}

function assertSnapshot(snapshot) {
  const facilities = snapshot.facilities.map(([stateCode, stateName, siteName, licenseType]) => ({ stateCode, stateName, siteName, licenseType }))
  const unique = new Set(facilities.map((facility) => `${facility.stateCode}:${facility.siteName}`))
  const general = facilities.filter((facility) => facility.licenseType === "general_license" || facility.licenseType === "general_and_site_specific").length
  const specific = facilities.filter((facility) => facility.licenseType === "site_specific_license" || facility.licenseType === "general_and_site_specific").length
  const states = new Set(facilities.map((facility) => facility.stateCode)).size
  if (unique.size !== snapshot.legend.uniqueFacilities || general !== snapshot.legend.generalLicenses || specific !== snapshot.legend.siteSpecificLicenses || states !== snapshot.legend.statesWithAtLeastOneIsfsi) {
    throw new Error(`Snapshot legend mismatch: ${unique.size} facilities, ${general} general licenses, ${specific} site-specific licenses, ${states} states`)
  }
}

async function main() {
  const workbookPath = resolve(process.argv[2] ?? defaultWorkbookPath)
  const payloadPath = resolve(process.argv[3] ?? defaultPayloadPath)
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"))
  assertSnapshot(snapshot)

  const retrievedAtUtc = new Date().toISOString()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(workbookPath)

  const sourceSheet = workbook.getWorksheet("SOURCES")
  const siteSheet = workbook.getWorksheet("SITES")
  const spentSheet = workbook.getWorksheet("SPENT_FUEL")
  const citationSheet = workbook.getWorksheet("CITATIONS")
  const releaseSheet = workbook.getWorksheet("RELEASE")

  const generatedSiteIds = new Set(snapshot.facilities.map(([, , siteName]) => existingSiteIds[siteName] ?? `site_isfsi_${slug(siteName)}`).filter((siteId) => siteId.startsWith("site_isfsi_")))
  const generatedStorageIds = new Set(snapshot.facilities.map(([, , siteName]) => existingStorageIds[siteName] ?? `spent_${slug(siteName)}_isfsi`).filter((storageId) => !Object.values(existingStorageIds).includes(storageId)))
  const generatedCitationIds = new Set(snapshot.facilities.map(([, , siteName]) => `cite_nrc_isfsi_2024_${slug(siteName)}`))
  clearRowsById(sourceSheet, new Set([snapshot.sourceId]))
  clearRowsById(siteSheet, generatedSiteIds)
  clearRowsById(spentSheet, generatedStorageIds)
  clearRowsById(citationSheet, generatedCitationIds)

  appendStructuredRow(sourceSheet, headers.SOURCES, {
      source_id: snapshot.sourceId,
      publisher: snapshot.publisher,
      source_name: snapshot.sourceName,
      authority_class: "official_regulatory",
      source_url: snapshot.sourceUrl,
      terms_url: "https://www.nrc.gov/about-nrc/regulatory/rulemaking/accessibility.html",
      reuse_status: "approved_factual_reuse",
      geographic_scope: "United States",
      source_as_of: snapshot.sourceAsOf,
      retrieved_at_utc: retrievedAtUtc,
      notes: "Official map lists facility names and general or site-specific license types. It reports 85 licenses across 80 facilities in 37 states.",
  })

  for (const [stateCode, stateName, siteName, licenseType, licensedOnly = false, installationType = "at_reactor_isfsi", storageMethod = ""] of snapshot.facilities) {
    const [latitude, longitude] = stateCentroids[stateCode]
    const siteId = existingSiteIds[siteName] ?? `site_isfsi_${slug(siteName)}`
    const storageId = existingStorageIds[siteName] ?? `spent_${slug(siteName)}_isfsi`
    const locationLabel = `${siteName}, ${stateName}`
    const coordinateNote = "State centroid used for map placement because the NRC map names the facility and state but does not publish machine-readable site coordinates."

    if (!findRow(siteSheet, headers.SITES, "site_id", siteId)) {
      appendStructuredRow(siteSheet, headers.SITES, {
        site_id: siteId,
        site_name: siteName,
        aliases: "",
        country_code: "US",
        country_name: "United States",
        admin1: stateName,
        locality: "",
        latitude,
        longitude,
        location_precision: "state",
        site_category: "spent_fuel_storage",
        public_status: licensedOnly ? "licensed_not_operating" : "operating",
        nrc_docket: "",
        eia_plant_id: "",
        notes: coordinateNote,
      })
    }

    let spentRow = findRow(spentSheet, headers.SPENT_FUEL, "storage_id", storageId)
    if (!spentRow) {
      spentRow = appendStructuredRow(spentSheet, headers.SPENT_FUEL, {
        storage_id: storageId,
        site_id: siteId,
        reactor_id: "",
        facility_name: siteName.includes("ISFSI") || siteName.includes("Storage") ? siteName : `${siteName} ISFSI`,
        installation_type: installationType,
        storage_method: storageMethod,
        license_number: "",
        license_type: licenseType,
        inventory_value: "",
        inventory_unit: "",
        inventory_date: "",
        status: licensedOnly ? "licensed_not_operating" : "operating",
        latitude,
        longitude,
        location_precision: "state",
        location_label: locationLabel,
        coordinate_note: coordinateNote,
        review_status: "needs_review",
      })
    } else {
      const licenseColumn = headers.SPENT_FUEL.indexOf("license_type") + 1
      spentRow.getCell(licenseColumn).value = licenseType
    }

    const citationId = `cite_nrc_isfsi_2024_${slug(siteName)}`
    if (!findRow(citationSheet, headers.CITATIONS, "citation_id", citationId)) {
      appendStructuredRow(citationSheet, headers.CITATIONS, {
        citation_id: citationId,
        record_table: "SPENT_FUEL",
        record_id: storageId,
        source_id: snapshot.sourceId,
        source_record_id: `${stateCode}:${slug(siteName)}`,
        locator: `Map list under ${stateName}: ${siteName}; legend and facility-status footnote`,
        supports_fields: "facility_name,license_type,status,location_label,location_precision",
        source_date_original: snapshot.sourceAsOf,
        source_date_precision: "day",
        effective_date: snapshot.sourceAsOf,
        retrieved_at_utc: retrievedAtUtc,
        review_status: "needs_review",
      })
    }
  }

  releaseSheet.getCell("D2").value = retrievedAtUtc
  releaseSheet.getCell("E2").value = ""
  releaseSheet.getCell("H2").value = "Draft static Atlas release with the NRC September 30, 2024 ISFSI map snapshot added for review."
  await workbook.xlsx.writeFile(workbookPath)

  const tablesWithoutHash = await readWorkbookTables(workbookPath)
  const releaseWithoutHash = buildAtlasRelease(tablesWithoutHash, "pending")
  releaseSheet.getCell("E2").value = releaseWithoutHash.canonicalModelSha256
  await workbook.xlsx.writeFile(workbookPath)

  const payload = {}
  for (const [sheetName, keys] of Object.entries(headers)) {
    const sheet = workbook.getWorksheet(sheetName)
    payload[sheetName] = [keys, ...rowsByHeader(sheet, keys).map((record) => keys.map((key) => record[key] ?? ""))]
  }
  await writeFile(payloadPath, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`Added ${snapshot.facilities.length} NRC ISFSI facilities to ${workbookPath}`)
  console.log(`Wrote Google Sheets payload to ${payloadPath}`)
}

await main()
