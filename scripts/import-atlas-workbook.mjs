import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import ExcelJS from "exceljs"

export const lifecycleTableConfig = [
  { table: "PROJECTS", stage: "projects", id: "project_id", label: "Projects" },
  { table: "FUEL_SUPPLY", stage: "fuel-supply", id: "facility_id", label: "Fuel Supply" },
  { table: "LICENSE_BUILD", stage: "build-license", id: "license_action_id", label: "Build & License" },
  { table: "OPERATIONS", stage: "operations", id: "operation_id", label: "Operations" },
  { table: "SPENT_FUEL", stage: "spent-fuel", id: "storage_id", label: "Spent Fuel" },
  { table: "WASTE_DISPOSAL", stage: "waste-disposal", id: "facility_id", label: "Waste & Disposal" },
  { table: "DECOMMISSIONING", stage: "decommissioning", id: "decom_id", label: "Decommissioning" },
]

const requiredHeaders = {
  RELEASE: ["release_id", "schema_version", "source_cutoff_utc", "generated_at_utc", "canonical_model_sha256", "review_status", "approved_by", "notes"],
  SOURCES: ["source_id", "publisher", "source_name", "authority_class", "source_url", "terms_url", "reuse_status", "geographic_scope", "source_as_of", "retrieved_at_utc", "notes"],
  SITES: ["site_id", "site_name", "aliases", "country_code", "country_name", "admin1", "locality", "latitude", "longitude", "location_precision", "site_category", "public_status", "nrc_docket", "eia_plant_id", "notes"],
  REACTORS: ["reactor_id", "site_id", "unit_name", "reactor_type", "reactor_model", "technology", "owner_name", "operator_name", "net_capacity_mw", "gross_capacity_mw", "thermal_capacity_mw", "construction_start", "first_criticality", "grid_connection", "commercial_operation", "permanent_shutdown", "operating_status", "status_as_of", "authority_id", "review_status"],
  PROJECTS: ["project_id", "project_name", "site_id", "reactor_id", "project_type", "offtaker", "developer", "technology_vendor", "utility", "epc", "offtaker_type", "technology", "firm_mw", "optioned_mw", "structure_type", "binding_tier", "binding_evidence", "announced_date", "target_operation", "status", "location_label", "latitude", "longitude", "location_precision", "coordinate_note", "analyst_note", "last_verified", "review_status"],
  FUEL_SUPPLY: ["facility_id", "site_id", "facility_name", "fuel_cycle_stage", "material_or_product", "status", "capacity_value", "capacity_unit", "capacity_basis", "docket_number", "status_as_of", "latitude", "longitude", "location_precision", "location_label", "coordinate_note", "review_status"],
  LICENSE_BUILD: ["license_action_id", "site_id", "reactor_id", "project_id", "facility_name", "regulator", "jurisdiction", "docket_number", "action_type", "reactor_design", "normalized_status", "source_status_text", "application_date", "decision_date", "effective_date", "status_as_of", "latitude", "longitude", "location_precision", "location_label", "coordinate_note", "review_status"],
  OPERATIONS: ["operation_id", "reactor_id", "site_id", "reactor_name", "period_start", "period_end", "period_frequency", "operating_status", "net_generation_mwh", "capacity_factor_pct", "outage_mw", "outage_type", "status_as_of", "latitude", "longitude", "location_precision", "location_label", "coordinate_note", "review_status"],
  SPENT_FUEL: ["storage_id", "site_id", "reactor_id", "facility_name", "installation_type", "storage_method", "license_number", "license_type", "inventory_value", "inventory_unit", "inventory_date", "status", "latitude", "longitude", "location_precision", "location_label", "coordinate_note", "review_status"],
  WASTE_DISPOSAL: ["facility_id", "site_id", "facility_name", "facility_type", "operating_status", "disposal_method", "waste_classes_accepted", "service_area", "jurisdiction", "status_as_of", "latitude", "longitude", "location_precision", "location_label", "coordinate_note", "review_status"],
  DECOMMISSIONING: ["decom_id", "site_id", "reactor_id", "facility_name", "strategy", "current_phase", "shutdown_date", "license_termination_target", "estimated_cost", "estimated_cost_currency", "trust_fund_balance", "trust_fund_date", "status_as_of", "latitude", "longitude", "location_precision", "location_label", "coordinate_note", "review_status"],
  CITATIONS: ["citation_id", "record_table", "record_id", "source_id", "source_record_id", "locator", "supports_fields", "source_date_original", "source_date_precision", "effective_date", "retrieved_at_utc", "review_status"],
}

const publishedReviewStates = new Set(["approved", "needs_review", "conflicting"])
const recordReviewStates = new Set([...publishedReviewStates, "excluded"])
const approvedReuseStates = new Set(["approved_factual_reuse", "approved_metadata_facts"])
const locationPrecisions = new Set(["site", "county", "state", "region", "country"])
const numericFields = {
  REACTORS: ["net_capacity_mw", "gross_capacity_mw", "thermal_capacity_mw"],
  PROJECTS: ["firm_mw", "optioned_mw", "latitude", "longitude"],
  FUEL_SUPPLY: ["capacity_value", "latitude", "longitude"],
  LICENSE_BUILD: ["latitude", "longitude"],
  OPERATIONS: ["net_generation_mwh", "capacity_factor_pct", "outage_mw", "latitude", "longitude"],
  SPENT_FUEL: ["inventory_value", "latitude", "longitude"],
  WASTE_DISPOSAL: ["latitude", "longitude"],
  DECOMMISSIONING: ["estimated_cost", "trust_fund_balance", "latitude", "longitude"],
}

function isAbsoluteHttpUrl(value) {
  try {
    const url = new URL(String(value ?? ""))
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function hasCitationMetadata(source) {
  return Boolean(
    String(source.publisher ?? "").trim()
    && String(source.source_name ?? "").trim()
    && isAbsoluteHttpUrl(source.source_url),
  )
}

function valueOf(cell) {
  const value = cell?.value
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "object") {
    if ("text" in value) return value.text
    if ("result" in value) return value.result ?? ""
    if ("richText" in value) return value.richText.map((part) => part.text).join("")
  }
  return value
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === null || value === undefined ? "" : value]))
}

function numberOrNull(value) {
  const normalized = typeof value === "string" ? value.trim() : value
  if (normalized === "" || normalized === null || normalized === undefined) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) throw new TypeError(`Invalid numeric value: ${value}`)
  return parsed
}

function textOrNull(value) {
  if (value === "" || value === null || value === undefined) return null
  return String(value)
}

export function parseSupportsFields(value) {
  const text = String(value ?? "").trim()
  if (!text) return []
  const parts = text.split(",").map((field) => field.trim()).filter(Boolean)
  return parts.every((field) => /^[a-z][a-z0-9_]*$/.test(field)) ? parts : [text]
}

function makeIndex(rows, key) {
  return new Map(rows.filter((row) => row[key]).map((row) => [String(row[key]), row]))
}

function duplicateErrors(table, rows, key) {
  const seen = new Set()
  const errors = []
  for (const row of rows) {
    const id = String(row[key] ?? "")
    if (!id) {
      errors.push(`${table} contains a row without ${key}`)
      continue
    }
    if (seen.has(id)) errors.push(`${table} contains duplicate ${key}: ${id}`)
    seen.add(id)
  }
  return errors
}

export function validateWorkbookTables(rawTables) {
  const tables = Object.fromEntries(Object.entries(rawTables).map(([name, rows]) => [name, rows.map(normalizeRow)]))
  const errors = []
  const sources = tables.SOURCES ?? []
  const sourceIds = new Set(sources.map((row) => String(row.source_id)))
  const reusableSourceIds = new Set(sources
    .filter((row) => approvedReuseStates.has(String(row.reuse_status)) && hasCitationMetadata(row))
    .map((row) => String(row.source_id)))
  const siteIds = new Set((tables.SITES ?? []).map((row) => String(row.site_id)))
  const reactorIds = new Set((tables.REACTORS ?? []).map((row) => String(row.reactor_id)))
  const projectIds = new Set((tables.PROJECTS ?? []).map((row) => String(row.project_id)))
  const citations = tables.CITATIONS ?? []
  const globalRecordIds = new Map()

  if ((tables.RELEASE ?? []).length !== 1) errors.push(`RELEASE must contain exactly one row; found ${(tables.RELEASE ?? []).length}`)
  const release = (tables.RELEASE ?? [])[0]
  if (release?.review_status === "approved" && !String(release.approved_by ?? "").trim()) {
    errors.push("RELEASE approved_by is required when review_status is approved")
  }
  if (release?.review_status === "approved") {
    for (const config of lifecycleTableConfig) {
      for (const row of tables[config.table] ?? []) {
        if (row.review_status !== "approved" && row.review_status !== "excluded") {
          errors.push(`${config.table} ${row[config.id]} must be approved or excluded before an approved release`)
        }
      }
    }
    for (const citation of citations) {
      if (citation.record_table && citation.record_id && citation.review_status !== "approved") {
        errors.push(`CITATIONS ${citation.citation_id} must be approved before an approved release`)
      }
    }
  }

  for (const config of lifecycleTableConfig) {
    const rows = tables[config.table] ?? []
    errors.push(...duplicateErrors(config.table, rows, config.id))
    const citedIds = new Set(citations.filter((citation) => citation.record_table === config.table
      && citation.source_id
      && reusableSourceIds.has(String(citation.source_id))
      && publishedReviewStates.has(String(citation.review_status))).map((citation) => String(citation.record_id)))
    for (const row of rows) {
      const id = String(row[config.id] ?? "")
      const parsedNumbers = {}
      for (const field of numericFields[config.table] ?? []) {
        try {
          parsedNumbers[field] = numberOrNull(row[field])
        } catch {
          parsedNumbers[field] = null
          errors.push(`${config.table} ${id} has invalid numeric value for ${field}: ${row[field]}`)
        }
      }
      if (id) {
        const owner = globalRecordIds.get(id)
        if (owner) errors.push(`${config.table} ${id} duplicates a record ID already used by ${owner}`)
        else globalRecordIds.set(id, config.table)
      }
      if (!recordReviewStates.has(String(row.review_status))) errors.push(`${config.table} ${id} has invalid review status ${row.review_status || "(blank)"}`)
      if (publishedReviewStates.has(String(row.review_status)) && !citedIds.has(id)) errors.push(`${config.table} ${id} is publishable but has no approved or reviewable citation`)
      if (row.site_id && !siteIds.has(String(row.site_id))) errors.push(`${config.table} ${id} references unknown site ${row.site_id}`)
      if (row.reactor_id && !reactorIds.has(String(row.reactor_id))) errors.push(`${config.table} ${id} references unknown reactor ${row.reactor_id}`)
      if (row.project_id && !projectIds.has(String(row.project_id))) errors.push(`${config.table} ${id} references unknown project ${row.project_id}`)
      if (row.location_precision && !locationPrecisions.has(String(row.location_precision))) errors.push(`${config.table} ${id} has invalid location precision ${row.location_precision}`)
      const latitude = parsedNumbers.latitude ?? null
      const longitude = parsedNumbers.longitude ?? null
      if ((latitude === null) !== (longitude === null)) errors.push(`${config.table} ${id} must provide both latitude and longitude`)
      if (latitude !== null && (latitude < -90 || latitude > 90)) errors.push(`${config.table} ${id} has invalid latitude ${row.latitude}`)
      if (longitude !== null && (longitude < -180 || longitude > 180)) errors.push(`${config.table} ${id} has invalid longitude ${row.longitude}`)
    }
  }

  errors.push(...duplicateErrors("SOURCES", tables.SOURCES ?? [], "source_id"))
  errors.push(...duplicateErrors("SITES", tables.SITES ?? [], "site_id"))
  errors.push(...duplicateErrors("REACTORS", tables.REACTORS ?? [], "reactor_id"))
  errors.push(...duplicateErrors("CITATIONS", citations, "citation_id"))

  for (const site of tables.SITES ?? []) {
    let latitude = null
    let longitude = null
    try { latitude = numberOrNull(site.latitude) } catch { errors.push(`SITES ${site.site_id} has invalid numeric value for latitude: ${site.latitude}`) }
    try { longitude = numberOrNull(site.longitude) } catch { errors.push(`SITES ${site.site_id} has invalid numeric value for longitude: ${site.longitude}`) }
    if ((latitude === null) !== (longitude === null)) errors.push(`SITES ${site.site_id} must provide both latitude and longitude`)
    if (latitude !== null && (latitude < -90 || latitude > 90)) errors.push(`SITES ${site.site_id} has invalid latitude ${site.latitude}`)
    if (longitude !== null && (longitude < -180 || longitude > 180)) errors.push(`SITES ${site.site_id} has invalid longitude ${site.longitude}`)
    if (site.location_precision && !locationPrecisions.has(String(site.location_precision))) errors.push(`SITES ${site.site_id} has invalid location precision ${site.location_precision}`)
  }
  for (const reactor of tables.REACTORS ?? []) {
    if (reactor.site_id && !siteIds.has(String(reactor.site_id))) errors.push(`REACTORS ${reactor.reactor_id} references unknown site ${reactor.site_id}`)
    for (const field of numericFields.REACTORS) {
      try { numberOrNull(reactor[field]) } catch { errors.push(`REACTORS ${reactor.reactor_id} has invalid numeric value for ${field}: ${reactor[field]}`) }
    }
  }
  const recordIdsByTable = new Map(lifecycleTableConfig.map((config) => [
    config.table,
    new Set((tables[config.table] ?? []).map((row) => String(row[config.id]))),
  ]))
  for (const citation of citations) {
    const recordTable = String(citation.record_table ?? "")
    const recordId = String(citation.record_id ?? "")
    if (recordTable || recordId) {
      if (!recordTable || !recordId) errors.push(`CITATIONS ${citation.citation_id} must name both record_table and record_id`)
      else if (!recordIdsByTable.has(recordTable)) errors.push(`CITATIONS ${citation.citation_id} references unsupported record table ${recordTable}`)
      else if (!recordIdsByTable.get(recordTable).has(recordId)) errors.push(`CITATIONS ${citation.citation_id} references unknown ${recordTable} record ${recordId}`)
    }
    if (citation.record_table && citation.record_id && !citation.source_id) errors.push(`CITATIONS ${citation.citation_id} must name a source_id`)
    if (citation.source_id && !sourceIds.has(String(citation.source_id))) errors.push(`CITATIONS ${citation.citation_id} references unknown source ${citation.source_id}`)
    if (citation.record_table && citation.record_id && citation.source_id && !reusableSourceIds.has(String(citation.source_id))) {
      errors.push(`CITATIONS ${citation.citation_id} cannot publish lifecycle facts from source ${citation.source_id} with blocked or metadata-only reuse`)
    }
  }
  for (const source of tables.SOURCES ?? []) {
    if (source.reuse_status && !approvedReuseStates.has(String(source.reuse_status)) && source.reuse_status !== "metadata_only" && source.reuse_status !== "blocked") {
      errors.push(`SOURCES ${source.source_id} has invalid reuse status ${source.reuse_status}`)
    }
    if (!String(source.publisher ?? "").trim()) errors.push(`SOURCES ${source.source_id} requires publisher metadata`)
    if (!String(source.source_name ?? "").trim()) errors.push(`SOURCES ${source.source_id} requires source_name metadata`)
    if (!isAbsoluteHttpUrl(source.source_url)) errors.push(`SOURCES ${source.source_id} requires an absolute HTTP(S) source_url`)
  }

  return errors
}

export async function readWorkbookTables(inputPath) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(inputPath)
  const tables = {}
  for (const [sheetName, headers] of Object.entries(requiredHeaders)) {
    const sheet = workbook.getWorksheet(sheetName)
    if (!sheet) throw new Error(`Workbook is missing required sheet ${sheetName}`)
    const actualHeaders = headers.map((_, index) => String(valueOf(sheet.getRow(1).getCell(index + 1))))
    if (JSON.stringify(actualHeaders) !== JSON.stringify(headers)) {
      throw new Error(`${sheetName} headers changed. Expected ${headers.join(", ")}; received ${actualHeaders.join(", ")}`)
    }
    const rows = []
    for (let rowIndex = 2; rowIndex <= sheet.actualRowCount; rowIndex += 1) {
      const row = Object.fromEntries(headers.map((header, index) => [header, valueOf(sheet.getRow(rowIndex).getCell(index + 1))]))
      if (Object.values(row).every((value) => value === "")) continue
      rows.push(normalizeRow(row))
    }
    tables[sheetName] = rows
  }
  return tables
}

function recordCitations(table, recordId, citations, sourceById) {
  return citations
    .filter((citation) => {
      const source = sourceById.get(String(citation.source_id))
      return citation.record_table === table
        && String(citation.record_id) === String(recordId)
        && publishedReviewStates.has(String(citation.review_status))
        && Boolean(source && approvedReuseStates.has(String(source.reuse_status)))
    })
    .map((citation) => {
      const source = sourceById.get(String(citation.source_id))
      return {
        id: citation.citation_id,
        sourceId: citation.source_id,
        publisher: source?.publisher ?? "Unknown publisher",
        sourceName: source?.source_name ?? "Unknown source",
        url: source?.source_url ?? "",
        locator: textOrNull(citation.locator),
        supportsFields: parseSupportsFields(citation.supports_fields),
        sourceDateOriginal: textOrNull(citation.source_date_original),
        sourceDatePrecision: textOrNull(citation.source_date_precision),
        effectiveDate: textOrNull(citation.effective_date),
        retrievedAtUtc: textOrNull(citation.retrieved_at_utc),
        reviewStatus: citation.review_status,
      }
    })
}

function makeLocation(row, siteById) {
  const site = row.site_id ? siteById.get(String(row.site_id)) : null
  const latitude = numberOrNull(row.latitude) ?? numberOrNull(site?.latitude)
  const longitude = numberOrNull(row.longitude) ?? numberOrNull(site?.longitude)
  if (latitude === null || longitude === null) return null
  return {
    latitude,
    longitude,
    precision: textOrNull(row.location_precision) ?? textOrNull(site?.location_precision) ?? "region",
    label: textOrNull(row.location_label) ?? textOrNull(site?.site_name) ?? "Location not labeled",
    coordinateNote: textOrNull(row.coordinate_note) ?? "Coordinates represent the public location at the stated precision.",
  }
}

function metric(label, value, unit = null) {
  if (value === "" || value === null || value === undefined) return null
  return { label, value: typeof value === "number" ? value : String(value), unit }
}

function detail(label, value) {
  const normalized = textOrNull(value)
  return normalized ? { label, value: normalized } : null
}

function baseRecord({ table, id, name, stage, row, citations, sourceById, siteById, status, typeLabel, technology, summary, asOf, metrics = [], details = [], href = null, evidenceStrength = null }) {
  const joinedCitations = recordCitations(table, id, citations, sourceById)
  const evidenceAsOf = joinedCitations
    .map((citation) => citation.effectiveDate ?? citation.sourceDateOriginal)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null
  return {
    id: String(id),
    stage,
    name: String(name),
    status: textOrNull(status),
    typeLabel: textOrNull(typeLabel),
    technology: textOrNull(technology),
    evidenceStrength: textOrNull(evidenceStrength),
    summary: textOrNull(summary),
    asOf: textOrNull(asOf) ?? evidenceAsOf,
    reviewStatus: textOrNull(row.review_status) ?? "needs_review",
    location: makeLocation(row, siteById),
    sourceIds: [...new Set(joinedCitations.map((citation) => citation.sourceId))],
    citations: joinedCitations,
    metrics: metrics.filter(Boolean),
    details: details.filter(Boolean),
    href,
  }
}

function buildRecords(table, rows, context) {
  const { citations, sourceById, siteById, reactorById } = context
  return rows.filter((row) => publishedReviewStates.has(String(row.review_status))).map((row) => {
    if (table === "PROJECTS") return baseRecord({
      table, id: row.project_id, name: row.project_name, stage: "projects", row, citations, sourceById, siteById,
      status: row.status, typeLabel: row.project_type, technology: row.technology, evidenceStrength: row.binding_tier,
      summary: row.binding_evidence, asOf: row.last_verified,
      metrics: [metric("Firm capacity", numberOrNull(row.firm_mw), "MW"), metric("Optioned capacity", numberOrNull(row.optioned_mw), "MW")],
      details: [detail("Offtaker", row.offtaker), detail("Developer", row.developer), detail("Technology vendor", row.technology_vendor), detail("Utility", row.utility), detail("EPC", row.epc), detail("Structure", row.structure_type), detail("Announced", row.announced_date), detail("Target operation", row.target_operation)],
      href: `/deal/${row.project_id}`,
    })
    if (table === "FUEL_SUPPLY") return baseRecord({
      table, id: row.facility_id, name: row.facility_name, stage: "fuel-supply", row, citations, sourceById, siteById,
      status: row.status, typeLabel: row.fuel_cycle_stage, technology: row.material_or_product,
      summary: `Public fuel-cycle facility record for ${row.material_or_product}.`, asOf: row.status_as_of,
      metrics: [metric("Reported capacity", numberOrNull(row.capacity_value), textOrNull(row.capacity_unit))],
      details: [detail("Fuel-cycle stage", row.fuel_cycle_stage), detail("Material or product", row.material_or_product), detail("Docket", row.docket_number), detail("Capacity basis", row.capacity_basis)],
    })
    if (table === "LICENSE_BUILD") return baseRecord({
      table, id: row.license_action_id, name: row.facility_name, stage: "build-license", row, citations, sourceById, siteById,
      status: row.normalized_status, typeLabel: row.action_type, technology: row.reactor_design,
      summary: row.source_status_text, asOf: row.status_as_of,
      details: [detail("Regulator", row.regulator), detail("Jurisdiction", row.jurisdiction), detail("Docket", row.docket_number), detail("Decision date", row.decision_date), detail("Effective date", row.effective_date)],
    })
    if (table === "OPERATIONS") {
      const reactor = reactorById.get(String(row.reactor_id))
      return baseRecord({
        table, id: row.operation_id, name: row.reactor_name, stage: "operations", row, citations, sourceById, siteById,
        status: row.operating_status, typeLabel: reactor?.reactor_type ?? "Reactor", technology: reactor?.reactor_type ?? reactor?.technology,
        summary: `Official operating-unit snapshot for ${row.reactor_name}.`, asOf: row.status_as_of,
        metrics: [metric("Net generation", numberOrNull(row.net_generation_mwh), "MWh"), metric("Capacity factor", numberOrNull(row.capacity_factor_pct), "%"), metric("Outage", numberOrNull(row.outage_mw), "MW")],
        details: [detail("Reactor type", reactor?.reactor_type), detail("Model", reactor?.reactor_model), detail("Reporting period", [row.period_start, row.period_end].filter(Boolean).join(" to ")), detail("Outage type", row.outage_type)],
      })
    }
    if (table === "SPENT_FUEL") return baseRecord({
      table, id: row.storage_id, name: row.facility_name, stage: "spent-fuel", row, citations, sourceById, siteById,
      status: row.status, typeLabel: row.license_type, technology: row.storage_method,
      summary: `Public spent-fuel storage license record. No inventory or remaining capacity is inferred.`, asOf: row.inventory_date,
      metrics: [metric("Published inventory", numberOrNull(row.inventory_value), textOrNull(row.inventory_unit))],
      details: [detail("Installation", row.installation_type), detail("Storage method", row.storage_method), detail("License", row.license_number), detail("License type", row.license_type)],
    })
    if (table === "WASTE_DISPOSAL") return baseRecord({
      table, id: row.facility_id, name: row.facility_name, stage: "waste-disposal", row, citations, sourceById, siteById,
      status: row.operating_status, typeLabel: row.facility_type, technology: row.disposal_method,
      summary: `Public disposal-facility record. Detailed transportation routes are excluded.`, asOf: row.status_as_of,
      details: [detail("Disposal method", row.disposal_method), detail("Waste classes", row.waste_classes_accepted), detail("Service area", row.service_area), detail("Jurisdiction", row.jurisdiction)],
    })
    return baseRecord({
      table, id: row.decom_id, name: row.facility_name, stage: "decommissioning", row, citations, sourceById, siteById,
      status: row.current_phase, typeLabel: row.strategy, technology: row.strategy,
      summary: `Public decommissioning status and strategy record.`, asOf: row.status_as_of,
      metrics: [metric("Estimated cost", numberOrNull(row.estimated_cost), textOrNull(row.estimated_cost_currency)), metric("Trust fund", numberOrNull(row.trust_fund_balance), textOrNull(row.estimated_cost_currency))],
      details: [detail("Strategy", row.strategy), detail("Current phase", row.current_phase), detail("Shutdown", row.shutdown_date), detail("License termination target", row.license_termination_target), detail("Trust fund date", row.trust_fund_date)],
    })
  })
}

export function buildAtlasRelease(tables, workbookSha256) {
  const errors = validateWorkbookTables(tables)
  if (errors.length) throw new Error(`Workbook validation failed:\n${errors.join("\n")}`)

  if (tables.RELEASE.length !== 1) throw new Error(`RELEASE must contain exactly one row; found ${tables.RELEASE.length}`)
  const release = tables.RELEASE[0]
  const sourceById = makeIndex(tables.SOURCES, "source_id")
  const siteById = makeIndex(tables.SITES, "site_id")
  const reactorById = makeIndex(tables.REACTORS, "reactor_id")
  const canonicalTables = structuredClone(tables)
  canonicalTables.RELEASE[0].canonical_model_sha256 = ""
  const canonicalWorkbook = JSON.stringify(Object.fromEntries(Object.entries(canonicalTables).sort(([a], [b]) => a.localeCompare(b))))
  const canonicalModelSha256 = createHash("sha256").update(canonicalWorkbook).digest("hex")
  const declaredCanonicalHash = textOrNull(release.canonical_model_sha256)
  if (declaredCanonicalHash && declaredCanonicalHash !== canonicalModelSha256) {
    throw new Error(`RELEASE canonical_model_sha256 does not match normalized workbook content: expected ${canonicalModelSha256}, received ${declaredCanonicalHash}`)
  }
  const context = { citations: tables.CITATIONS, sourceById, siteById, reactorById }
  const stages = {}
  for (const config of lifecycleTableConfig) {
    const records = buildRecords(config.table, tables[config.table], context)
    stages[config.stage] = {
      stage: config.stage,
      label: config.label,
      status: records.length === 0 ? "coverage_only" : release.review_status === "approved" ? "published" : "draft",
      records,
      recordCount: records.length,
      sourceIds: [...new Set(records.flatMap((record) => record.sourceIds))],
    }
  }
  return {
    schemaVersion: Number(release.schema_version),
    releaseId: release.release_id,
    reviewStatus: release.review_status,
    approvedBy: textOrNull(release.approved_by),
    sourceCutoffUtc: textOrNull(release.source_cutoff_utc),
    generatedAtUtc: textOrNull(release.generated_at_utc),
    workbookSha256,
    canonicalModelSha256,
    sourceCount: tables.SOURCES.length,
    sources: tables.SOURCES.map((source) => ({
      id: source.source_id,
      publisher: source.publisher,
      name: source.source_name,
      authorityClass: source.authority_class,
      url: source.source_url,
      reuseStatus: source.reuse_status,
      geographicScope: source.geographic_scope,
      sourceAsOf: textOrNull(source.source_as_of),
      retrievedAtUtc: textOrNull(source.retrieved_at_utc),
      plainEnglish: textOrNull(source.notes),
    })),
    stages,
  }
}

export async function importAtlasWorkbook(inputPath, outputPath) {
  const workbookBytes = await readFile(inputPath)
  const workbookSha256 = createHash("sha256").update(workbookBytes).digest("hex")
  const tables = await readWorkbookTables(inputPath)
  const release = buildAtlasRelease(tables, workbookSha256)
  const outputUrl = outputPath instanceof URL ? outputPath : pathToFileURL(resolve(outputPath))
  await mkdir(new URL("./", outputUrl), { recursive: true })
  await writeFile(outputUrl, `${JSON.stringify(release, null, 2)}\n`)
  return release
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const inputPath = process.argv[2]
  const outputPath = process.argv[3] ?? new URL("../data/atlas-release.json", import.meta.url)
  if (!inputPath) throw new Error("Usage: node scripts/import-atlas-workbook.mjs <workbook.xlsx> [output.json]")
  const release = await importAtlasWorkbook(inputPath, outputPath)
  console.log(`Imported ${Object.values(release.stages).reduce((sum, stage) => sum + stage.records.length, 0)} records from ${release.sourceCount} sources (workbook ${release.workbookSha256}; model ${release.canonicalModelSha256}).`)
}
