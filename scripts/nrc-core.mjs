import ExcelJS from "exceljs"

function cellValue(cell) {
  const value = cell?.value
  if (value === null || value === undefined) return ""
  if (typeof value === "object") {
    if (value instanceof Date) return value
    if ("text" in value) return value.text
    if ("result" in value) return value.result ?? ""
    if ("richText" in value) return value.richText.map((part) => part.text).join("")
  }
  return value
}

function text(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").trim()
}

function dateOnly(value) {
  if (value === "" || value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "number") {
    if (Number.isInteger(value) && value >= 1900 && value <= 2200) return String(value)
    const utcMilliseconds = Math.round((value - 25569) * 86_400_000)
    return new Date(utcMilliseconds).toISOString().slice(0, 10)
  }
  const normalized = text(value)
  if (!normalized || normalized === "N/A") return ""
  if (/^\d{4}$/.test(normalized)) return normalized
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString().slice(0, 10)
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function rowObject(sheet, rowIndex) {
  const headers = sheet.getRow(1).values.slice(1).map(text)
  const row = sheet.getRow(rowIndex)
  return Object.fromEntries(headers.map((header, index) => [header, cellValue(row.getCell(index + 1))]))
}

function htmlText(value) {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&ndash;|&#8211;/gi, "-")
    .replace(/&mdash;|&#8212;/gi, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim()
}

export function normalizeDocket(value) {
  const original = text(value)
  // The NRC operating-reactor workbook publishes Palo Verde 2 with a stray apostrophe.
  if (original === "0'5000529") return "05000529"
  if (!/^\d+$/.test(original) && !/^\d{2,3}-\d{1,5}$/.test(original)) return ""
  const hyphenated = original.match(/^(\d{2,3})-(\d+)$/)
  let digits = hyphenated
    ? `${hyphenated[1].padStart(3, "0")}${hyphenated[2].padStart(5, "0")}`
    : original
  if (!digits) return ""
  // The NRC former-reactor workbook publishes TMI-1 with one extra zero.
  if (digits === "050000289") return "05000289"
  if (digits.length > 8) return ""
  if (digits.length < 8 && /^0(?:40|50|52|70)/.test(digits)) digits = `${digits.slice(0, 3)}${digits.slice(3).padStart(5, "0")}`
  else if (digits.length < 8 && /^(?:40|50|52|70)/.test(digits)) digits = `0${digits.slice(0, 2)}${digits.slice(2).padStart(5, "0")}`
  return /^(?:040|050|052|070)\d{5}$/.test(digits) ? digits : ""
}

export function parseCurrentOperatingHtml(html) {
  const table = html.match(/<table[^>]*summary="List of Power Reactor Units"[\s\S]*?<\/table>/i)?.[0]
  if (!table) throw new Error("NRC operating-unit table was not found")
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].slice(1)
  return rows.map((rowMatch) => {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => htmlText(match[1]))
    const [unitName = "", docketNumber = ""] = cells[0].split("\n")
    return {
      unitName,
      docketNumber: normalizeDocket(docketNumber),
      licenseNumber: cells[1] ?? "",
      reactorType: cells[2] ?? "",
      location: cells[3] ?? "",
      ownerOperator: cells[4] ?? "",
      nrcRegion: cells[5] ?? "",
    }
  }).filter((row) => row.unitName && row.docketNumber)
}

export function parseFuelCycleHtml(html) {
  const featuresJson = html.match(/"features":(\[\{\"type\":\"Feature\"[\s\S]*?\}\])\}\}\},\"user\"/)?.[1]
  if (!featuresJson) throw new Error("NRC fuel-cycle map features were not found")
  const mapFacilities = JSON.parse(featuresJson).map((feature) => {
    const data = feature.properties?.data ?? {}
    const href = text(data.field_page_ref).match(/href="([^"]+)"/)?.[1] ?? ""
    return {
      name: text(data.title),
      location: text(data.field_location),
      facilityType: text(data.field_reactor_type),
      latitude: Number(feature.geometry.coordinates[1]),
      longitude: Number(feature.geometry.coordinates[0]),
      pagePath: href,
    }
  })

  const facilityTable = html.match(/<table[^>]*summary="Layout table for: Location and type of Fuel Cycle Facilities"[\s\S]*?<\/table>/i)?.[0]
  if (!facilityTable) throw new Error("NRC fuel-cycle facility table was not found")

  const mapByPath = new Map(mapFacilities.filter((facility) => facility.pagePath).map((facility) => [facility.pagePath, facility]))
  const mapByName = new Map(mapFacilities.map((facility) => [facility.name, facility]))
  const facilities = []
  let facilityType = ""

  for (const row of facilityTable.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)]
    if (cells.length === 1 && /\bcolspan\s*=\s*["']?3\b/i.test(cells[0][1])) {
      facilityType = htmlText(cells[0][2])
      continue
    }
    if (cells.length < 2) continue

    const identityHtml = cells[0][2]
    const identityText = htmlText(identityHtml)
    const pagePath = identityHtml.match(/href="([^"]+)"/i)?.[1] ?? ""
    const docketNumber = normalizeDocket(identityText.match(/\((\d{8})\)/)?.[1] ?? "")
    const name = identityText.replace(/\s*\[[\s\S]*$/, "").trim()
    const location = htmlText(cells[1][2])
    if (!name || !location || !docketNumber) continue

    const mapped = mapByPath.get(pagePath) ?? mapByName.get(name)
    facilities.push({
      name,
      location,
      facilityType: mapped?.facilityType || facilityType,
      docketNumber,
      latitude: mapped?.latitude ?? null,
      longitude: mapped?.longitude ?? null,
      pagePath,
    })
  }

  return facilities
}

export async function parseOperatingWorkbook(path) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path)
  const sheet = workbook.worksheets[0]
  const records = []
  for (let rowIndex = 2; rowIndex <= sheet.actualRowCount; rowIndex += 1) {
    const row = rowObject(sheet, rowIndex)
    if (!text(row["Plant Name, Unit Number"])) continue
    records.push({
      sourceYear: text(row["Year of Update"]),
      unitName: text(row["Plant Name, Unit Number"]),
      shortName: text(row["NRC Reactor Unit Web Page"]),
      docketNumber: normalizeDocket(row["Docket Number"]),
      licenseNumber: text(row["License Number"]),
      location: text(row.Location),
      nrcRegion: text(row["NRC Region"]),
      ownerName: text(row["Parent Company Utility Name"]),
      operatorName: text(row.Licensee),
      reactorAndContainmentType: text(row["Reactor and Containment Type"]),
      reactorModel: text(row["Nuclear Steam System Supplier and Design Type"]),
      constructionStart: dateOnly(row["Construction Permit Issued"]),
      operatingLicenseIssued: dateOnly(row["Operating License Issued"]),
      commercialOperation: dateOnly(row["Commercial Operation"]),
      thermalCapacityMw: numberOrNull(row["Licensed MWt"]),
      netCapacityMw: numberOrNull(row["Capacity MWe"]),
    })
  }
  return records
}

export async function parseDecommissioningWorkbook(path) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path)
  const sheet = workbook.worksheets[0]
  const records = []
  for (let rowIndex = 2; rowIndex <= sheet.actualRowCount; rowIndex += 1) {
    const row = rowObject(sheet, rowIndex)
    if (!text(row.Unit)) continue
    records.push({
      sourceYear: text(row["Year of Update"]),
      unitName: text(row.Unit),
      location: text(row.Location),
      docketNumber: normalizeDocket(row["Docket Number"]),
      reactorType: text(row["Reactor Type"]),
      thermalCapacityMw: numberOrNull(row.MWt),
      reactorModel: text(row["NSSS Vendor"]),
      operatingLicenseIssued: dateOnly(row["Operating License (OL) Issued"]),
      shutdownDate: dateOnly(row["Shut Down"]),
      operatingLicenseTerminated: dateOnly(row["Operating License (OL) Terminated"]),
      licenseTerminationTarget: dateOnly(row["Closure Date Est."]),
      strategy: text(row["Decommissioning Alternative Selected"]),
      currentPhase: text(row["Current License Status"]),
    })
  }
  return records
}

export async function parseActionMatrixWorkbook(path) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path)
  const sheet = workbook.worksheets[0]
  const latestRow = sheet.getRow(sheet.actualRowCount)
  const quarter = text(latestRow.getCell(1).value)
  const byUnit = new Map()
  for (let column = 2; column <= sheet.actualColumnCount; column += 1) {
    const unitName = text(sheet.getRow(1).getCell(column).value)
    const value = numberOrNull(latestRow.getCell(column).value)
    if (unitName) byUnit.set(unitName, value)
  }
  return { quarter, byUnit }
}

export function actionMatrixLabel(value) {
  return new Map([
    [1, "Licensee Response Column"],
    [2, "Regulatory Response Column"],
    [3, "Degraded Performance Column"],
    [4, "Multiple/Repetitive Degraded Cornerstone Column"],
    [5, "Unacceptable Performance Column"],
  ]).get(value) ?? "Not available"
}

export function findingMetricValues(finding) {
  if (!finding) return { publicFindingCount: "", greaterThanGreenCount: "", latestFindingDate: "" }
  return {
    publicFindingCount: finding.total,
    greaterThanGreenCount: finding.greaterThanGreen,
    latestFindingDate: finding.latestIssueDate,
  }
}

export async function buildFindingSummary(path, { year, coveredDockets = [] }) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path)
  const sheet = workbook.worksheets[0]
  const byDocket = new Map(coveredDockets.map((docketNumber) => [docketNumber, { total: 0, greaterThanGreen: 0, latestIssueDate: "" }]))
  for (let rowIndex = 2; rowIndex <= sheet.actualRowCount; rowIndex += 1) {
    const row = rowObject(sheet, rowIndex)
    if (Number(row.Year) !== year) continue
    const docketNumber = normalizeDocket(row["Docket Number"])
    if (!docketNumber) continue
    const current = byDocket.get(docketNumber) ?? { total: 0, greaterThanGreen: 0, latestIssueDate: "" }
    current.total += 1
    const significance = text(row.Significance).toLowerCase()
    if (significance && significance !== "green" && significance !== "none" && significance !== "not applicable") current.greaterThanGreen += 1
    const issueDate = dateOnly(row["Issue Date"])
    if (issueDate > current.latestIssueDate) current.latestIssueDate = issueDate
    byDocket.set(docketNumber, current)
  }
  return { year, byDocket }
}
