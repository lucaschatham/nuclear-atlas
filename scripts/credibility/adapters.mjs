import {
  ParseError,
  SchemaDriftError,
  SourceAuthError,
  SourceTimeoutError,
  SourceUnavailableError,
  TermsBlockedError,
  assertAllowedSourceUrl,
} from "./core.mjs"

function dateOnly(value) {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

function maximumDate(values) {
  const valid = values.filter(Boolean).map((value) => new Date(value)).filter((value) => !Number.isNaN(value.valueOf()))
  if (!valid.length) return null
  return new Date(Math.max(...valid.map((value) => value.valueOf()))).toISOString()
}

function parseNrcDate(value) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return null
  const [, month, day, year] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString()
}

function getPath(value, path) {
  return path.split(".").filter(Boolean).reduce((current, key) => current?.[key], value)
}

function parseJson(body, sourceId) {
  try {
    return JSON.parse(body)
  } catch (error) {
    throw new ParseError(`${sourceId} returned malformed JSON.`, { cause: error })
  }
}

function normalizeNrcStatus(body, source) {
  const lines = body.trim().split(/\r?\n/)
  if (lines[0] !== "ReportDt|Unit|Power") {
    throw new SchemaDriftError("NRC reactor status header changed.")
  }
  const allRecords = lines.slice(1).filter(Boolean).map((line) => {
    const [report_date, unit, power] = line.split("|")
    if (!report_date || !unit || power === undefined) {
      throw new SchemaDriftError("NRC reactor status row shape changed.")
    }
    const powerPercent = Number(power)
    if (!Number.isFinite(powerPercent) || powerPercent < 0 || powerPercent > 100) {
      throw new SchemaDriftError(`NRC reactor status power value is invalid for ${unit}.`)
    }
    if (!parseNrcDate(report_date)) throw new SchemaDriftError(`NRC reactor status date is invalid for ${unit}.`)
    return { report_date, unit, power_percent: powerPercent }
  })
  const sourcePublishedAt = maximumDate(allRecords.map((record) => parseNrcDate(record.report_date)))
  const latestDate = sourcePublishedAt?.slice(0, 10) ?? null
  const records = latestDate
    ? allRecords.filter((record) => parseNrcDate(record.report_date)?.startsWith(latestDate))
    : allRecords
  const uniqueUnits = new Set(records.map((record) => record.unit))
  if (uniqueUnits.size !== records.length) throw new SchemaDriftError("NRC latest-day reactor status contains duplicate units.")
  if (source.minimum_record_count && records.length < source.minimum_record_count) {
    throw new SchemaDriftError(`NRC latest-day reactor status returned ${records.length} rows; expected at least ${source.minimum_record_count}.`)
  }
  return {
    records,
    sourcePublishedAt,
    isComplete: true,
  }
}

function normalizeFederalRegister(body, sourceId) {
  const payload = parseJson(body, sourceId)
  if (!Array.isArray(payload.results)) {
    throw new SchemaDriftError("Federal Register response no longer contains a results array.")
  }
  return {
    records: payload.results,
    sourcePublishedAt: maximumDate(payload.results.map((record) => dateOnly(record.publication_date))),
    isComplete: Number(payload.count ?? payload.results.length) <= payload.results.length,
  }
}

function normalizeUsaSpending(body, sourceId) {
  const payload = parseJson(body, sourceId)
  if (!Array.isArray(payload.results)) {
    throw new SchemaDriftError("USAspending response no longer contains a results array.")
  }
  return {
    records: payload.results,
    sourcePublishedAt: maximumDate(payload.results.map((record) => record["Last Modified Date"])),
    isComplete: payload.page_metadata?.hasNext === false,
  }
}

function normalizeSecSubmissions(body, sourceId) {
  const payload = parseJson(body, sourceId)
  const recent = payload?.filings?.recent
  if (!recent || !Array.isArray(recent.accessionNumber) || !Array.isArray(recent.filingDate)) {
    throw new SchemaDriftError("SEC submissions response no longer contains filings.recent arrays.")
  }
  const records = recent.accessionNumber.map((accessionNumber, index) => ({
    accession_number: accessionNumber,
    filing_date: recent.filingDate[index] ?? null,
    report_date: recent.reportDate?.[index] ?? null,
    form: recent.form?.[index] ?? null,
    primary_document: recent.primaryDocument?.[index] ?? null,
  }))
  return {
    records,
    sourcePublishedAt: maximumDate(records.map((record) => dateOnly(record.filing_date))),
    isComplete: true,
  }
}

function normalizeGrants(body, sourceId) {
  const payload = parseJson(body, sourceId)
  const records = payload?.data?.oppHits
  if (!Array.isArray(records)) {
    throw new SchemaDriftError("Grants.gov response no longer contains data.oppHits.")
  }
  return {
    records,
    sourcePublishedAt: null,
    isComplete: Number(payload.data.hitCount ?? records.length) <= records.length,
  }
}

function normalizeOsti(body, sourceId) {
  const records = parseJson(body, sourceId)
  if (!Array.isArray(records)) {
    throw new SchemaDriftError("OSTI response is no longer an array.")
  }
  return {
    records,
    sourcePublishedAt: maximumDate(records.map((record) => record.entry_date)),
    isComplete: true,
  }
}

function normalizeJsonRecords(body, source) {
  const payload = parseJson(body, source.id)
  const recordsPath = source.request?.records_path ?? "records"
  const records = getPath(payload, recordsPath)
  if (!Array.isArray(records)) {
    throw new SchemaDriftError(`${source.id} response no longer contains ${recordsPath}.`)
  }
  return { records, sourcePublishedAt: null, isComplete: true }
}

const normalizers = {
  nrc_reactor_status: (body, source) => normalizeNrcStatus(body, source),
  federal_register: (body, source) => normalizeFederalRegister(body, source.id),
  usaspending: (body, source) => normalizeUsaSpending(body, source.id),
  sec_submissions: (body, source) => normalizeSecSubmissions(body, source.id),
  grants_gov: (body, source) => normalizeGrants(body, source.id),
  osti_records: (body, source) => normalizeOsti(body, source.id),
  json_records: (body, source) => normalizeJsonRecords(body, source),
}

export async function readResponseBody(response, maximumBytes, sourceId) {
  const contentLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    await response.body?.cancel().catch(() => {})
    throw new ParseError(`${sourceId} exceeded its ${maximumBytes}-byte response limit.`)
  }
  if (!response.body) return ""

  const reader = response.body.getReader()
  const chunks = []
  let byteCount = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteCount += value.byteLength
      if (byteCount > maximumBytes) {
        await reader.cancel().catch(() => {})
        throw new ParseError(`${sourceId} exceeded its ${maximumBytes}-byte response limit.`)
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  return new TextDecoder().decode(Buffer.concat(chunks, byteCount))
}

function replaceTemplates(value, { checkedAt, previousReceipt }) {
  if (typeof value === "string") {
    const today = checkedAt.slice(0, 10)
    const since = previousReceipt?.checked_at?.slice(0, 10) ?? new Date(new Date(checkedAt).valueOf() - 7 * 86400000).toISOString().slice(0, 10)
    return value.replaceAll("{{today}}", today).replaceAll("{{since}}", since)
  }
  if (Array.isArray(value)) return value.map((item) => replaceTemplates(item, { checkedAt, previousReceipt }))
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceTemplates(item, { checkedAt, previousReceipt })]))
  }
  return value
}

function buildRequest(source, options) {
  const request = source.request ?? { method: "GET" }
  const url = new URL(source.endpoint)
  const query = replaceTemplates(request.query ?? {}, options)
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item))
    } else if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value))
    }
  }

  const headers = new Headers(request.headers ?? {})
  let body
  if (request.body) {
    headers.set("content-type", "application/json")
    body = JSON.stringify(replaceTemplates(request.body, options))
  }

  if (source.auth_method === "api_key" || source.auth_method === "subscription") {
    const key = process.env[source.auth_env]
    if (!key) throw new SourceAuthError(`${source.id} requires ${source.auth_env}.`)
    if (source.auth_placement === "header") headers.set(source.auth_parameter, key)
    else url.searchParams.set(source.auth_parameter, key)
  }

  if (source.auth_method === "user_agent") {
    const userAgent = process.env[source.auth_env]
    if (!userAgent) throw new SourceAuthError(`${source.id} requires ${source.auth_env}.`)
    headers.set("user-agent", userAgent)
  }

  if (["manual", "restricted"].includes(source.auth_method)) {
    throw new TermsBlockedError(`${source.id} is not approved for automated retrieval.`)
  }

  if (options.previousReceipt?.etag) headers.set("if-none-match", options.previousReceipt.etag)
  if (options.previousReceipt?.last_modified) headers.set("if-modified-since", options.previousReceipt.last_modified)

  assertAllowedSourceUrl(url.toString(), source.allowed_hosts)
  return { url: url.toString(), init: { method: request.method ?? "GET", headers, body } }
}

async function fetchWithAllowedRedirects({ source, request, fetchImpl, signal }) {
  let requestUrl = request.url
  let requestInit = { ...request.init, headers: new Headers(request.init.headers) }
  const redirectStatuses = new Set([301, 302, 303, 307, 308])

  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    const response = await fetchImpl(requestUrl, { ...requestInit, redirect: "manual", signal })
    if (!redirectStatuses.has(response.status)) return { response, requestUrl }
    if (redirectCount === 5) {
      await response.body?.cancel().catch(() => {})
      throw new SourceUnavailableError(`${source.id} exceeded five redirects.`)
    }
    const location = response.headers.get("location")
    if (!location) {
      await response.body?.cancel().catch(() => {})
      throw new SourceUnavailableError(`${source.id} returned a redirect without a Location header.`)
    }
    const nextUrl = new URL(location, requestUrl).toString()
    assertAllowedSourceUrl(nextUrl, source.allowed_hosts)
    if (["api_key", "subscription"].includes(source.auth_method)) {
      const currentOrigin = new URL(requestUrl).origin
      const nextOrigin = new URL(nextUrl).origin
      if (currentOrigin !== nextOrigin) {
        await response.body?.cancel().catch(() => {})
        throw new TermsBlockedError(`${source.id} cannot forward credentials across origins.`)
      }
    }
    await response.body?.cancel().catch(() => {})

    if (response.status === 303 || ([301, 302].includes(response.status) && requestInit.method === "POST")) {
      const headers = new Headers(requestInit.headers)
      headers.delete("content-type")
      requestInit = { ...requestInit, method: "GET", headers, body: undefined }
    }
    requestUrl = nextUrl
  }
  throw new SourceUnavailableError(`${source.id} redirect handling failed.`)
}

export async function fetchSourcePayload({ source, checkedAt, previousReceipt, fetchImpl = globalThis.fetch }) {
  const request = buildRequest(source, { checkedAt, previousReceipt })
  const startedAt = performance.now()
  let response
  let requestUrl = request.url

  try {
    const fetched = await fetchWithAllowedRedirects({
      source,
      request,
      fetchImpl,
      signal: AbortSignal.timeout(source.timeout_ms),
    })
    response = fetched.response
    requestUrl = fetched.requestUrl
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new SourceTimeoutError(`${source.id} exceeded its ${source.timeout_ms}ms timeout.`, { cause: error })
    }
    if (error instanceof TermsBlockedError || error instanceof SourceUnavailableError) throw error
    throw new SourceUnavailableError(`${source.id} could not be reached.`, { cause: error })
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? null
  if (response.ok && response.status !== 304 && source.accepted_content_types?.length) {
    const accepted = source.accepted_content_types.some((type) => contentType?.startsWith(type.toLowerCase()))
    if (!accepted) {
      throw new ParseError(`${source.id} returned unexpected content type ${contentType ?? "missing"}.`)
    }
  }

  let body = ""
  if (response.status !== 304) {
    try {
      body = await readResponseBody(response, source.maximum_response_bytes, source.id)
    } catch (error) {
      if (error instanceof ParseError) throw error
      throw new SourceUnavailableError(`${source.id} response stream failed.`, { cause: error })
    }
  }

  return {
    requestUrl,
    response,
    body,
    durationMs: Math.round(performance.now() - startedAt),
  }
}

export function normalizeSourcePayload(source, body) {
  const normalize = normalizers[source.adapter]
  if (!normalize) throw new SchemaDriftError(`No adapter registered for ${source.adapter}.`)
  return normalize(body, source)
}
