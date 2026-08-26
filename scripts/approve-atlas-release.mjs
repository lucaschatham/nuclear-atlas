import { pathToFileURL } from "node:url"

import ExcelJS from "exceljs"

import { buildAtlasRelease, lifecycleTableConfig, readWorkbookTables } from "./import-atlas-workbook.mjs"

const releasableRecordStates = new Set(["approved", "excluded"])
const releasableCitationStates = new Set(["approved"])

function headerIndex(sheet, header) {
  for (let column = 1; column <= sheet.actualColumnCount; column += 1) {
    if (String(sheet.getRow(1).getCell(column).value ?? "") === header) return column
  }
  throw new Error(`${sheet.name} is missing ${header}`)
}

export function approvalBlocker(tableName, id, status, { citation = false } = {}) {
  if (status === "conflicting") return `${tableName} ${id} remains conflicting and cannot be approved`
  if (status === "needs_review") return `${tableName} ${id} still needs row-level review`
  const allowedStates = citation ? releasableCitationStates : releasableRecordStates
  if (!allowedStates.has(status)) return `${tableName} ${id} has unsupported release status ${status || "(blank)"}`
  return null
}

function requireApprovedRows(tableName, rows, idHeader, options) {
  let checked = 0
  for (const row of rows) {
    const id = String(row[idHeader] ?? "").trim()
    const status = String(row.review_status ?? "").trim()
    const blocker = approvalBlocker(tableName, id, status, options)
    if (blocker) throw new Error(blocker)
    checked += 1
  }

  return checked
}

export async function approveAtlasWorkbook(inputPath, { approvedBy, approvedAtUtc, notes }) {
  const tables = await readWorkbookTables(inputPath)
  let checkedRecords = 0
  for (const config of lifecycleTableConfig) {
    checkedRecords += requireApprovedRows(config.table, tables[config.table], config.id)
  }
  const checkedCitations = requireApprovedRows("CITATIONS", tables.CITATIONS, "citation_id", { citation: true })

  const stagedTables = structuredClone(tables)
  stagedTables.RELEASE[0].generated_at_utc = approvedAtUtc
  stagedTables.RELEASE[0].canonical_model_sha256 = ""
  stagedTables.RELEASE[0].review_status = "approved"
  stagedTables.RELEASE[0].approved_by = approvedBy
  stagedTables.RELEASE[0].notes = notes
  const release = buildAtlasRelease(stagedTables, "pending-final-workbook-hash")

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(inputPath)
  const releaseSheet = workbook.getWorksheet("RELEASE")
  const releaseRow = releaseSheet.getRow(2)
  releaseRow.getCell(headerIndex(releaseSheet, "generated_at_utc")).value = approvedAtUtc
  releaseRow.getCell(headerIndex(releaseSheet, "canonical_model_sha256")).value = release.canonicalModelSha256
  releaseRow.getCell(headerIndex(releaseSheet, "review_status")).value = "approved"
  releaseRow.getCell(headerIndex(releaseSheet, "approved_by")).value = approvedBy
  releaseRow.getCell(headerIndex(releaseSheet, "notes")).value = notes
  await workbook.xlsx.writeFile(inputPath)

  return { checkedRecords, checkedCitations, canonicalModelSha256: release.canonicalModelSha256 }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const inputPath = process.argv[2]
  const approvedBy = process.argv[3]
  if (!inputPath || !approvedBy) {
    throw new Error("Usage: node scripts/approve-atlas-release.mjs <workbook.xlsx> <approved-by>")
  }
  const approvedAtUtc = new Date().toISOString()
  const result = await approveAtlasWorkbook(inputPath, {
    approvedBy,
    approvedAtUtc,
    notes: `Approved for production by ${approvedBy} on ${approvedAtUtc.slice(0, 10)}. Includes the NRC September 30, 2024 ISFSI snapshot.`,
  })
  console.log(`Approved Atlas workbook after verifying ${result.checkedRecords} records and ${result.checkedCitations} citations. Model ${result.canonicalModelSha256}.`)
}
