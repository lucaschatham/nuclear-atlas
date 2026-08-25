import {
  SourceAuthError,
  SourceRateLimitError,
  SourceUnavailableError,
  SchemaDriftError,
  UnexpectedEmptyError,
  buildReceipt,
  hashContent,
} from "./core.mjs"
import { fetchSourcePayload, normalizeSourcePayload } from "./adapters.mjs"

function httpError(response, sourceId) {
  const options = {
    httpStatus: response.status,
    retryAfter: response.headers.get("retry-after"),
  }
  if ([401, 403].includes(response.status)) return new SourceAuthError(`${sourceId} returned HTTP ${response.status}.`, options)
  if (response.status === 429) return new SourceRateLimitError(`${sourceId} returned HTTP 429.`, options)
  return new SourceUnavailableError(`${sourceId} returned HTTP ${response.status}.`, options)
}

function successfulReceipt(receipt) {
  return receipt && ["changed", "unchanged"].includes(receipt.status)
}

function getPath(value, path) {
  return path.split(".").filter(Boolean).reduce((current, key) => current?.[key], value)
}

function incrementalRecord(source, record) {
  const id = getPath(record, source.incremental_record_id_path)
  const timestampValue = getPath(record, source.incremental_record_timestamp_path)
  const timestamp = new Date(timestampValue)
  if (id === null || id === undefined || id === "") {
    throw new SchemaDriftError(`${source.id} returned an incremental record without ${source.incremental_record_id_path}.`)
  }
  if (Number.isNaN(timestamp.valueOf())) {
    throw new SchemaDriftError(`${source.id} returned an incremental record without a valid ${source.incremental_record_timestamp_path}.`)
  }
  return {
    id: String(id),
    timestamp: timestamp.toISOString(),
    fingerprint: `${String(id)}:${hashContent(JSON.stringify(record))}`,
    record,
  }
}

function compareIncrementalRecords(source, records, previousReceipt, currentHash) {
  if (!source.incremental_record_id_path || !source.incremental_record_timestamp_path) {
    throw new SchemaDriftError(`${source.id} lacks its incremental record identity contract.`)
  }

  const normalized = records.map((record) => incrementalRecord(source, record))
  const legacyBaseline = previousReceipt
    && !Object.hasOwn(previousReceipt, "incremental_cursor_at")
  if (legacyBaseline) {
    const previousHash = previousReceipt.normalized_sha256 ?? previousReceipt.sha256
    if (previousHash !== currentHash) {
      throw new SchemaDriftError(`${source.id} changed before its incremental cursor migration; review and establish a manual baseline.`)
    }
  }
  const previousCursorAt = previousReceipt?.incremental_cursor_at ?? null
  const previousFingerprints = new Set(previousReceipt?.incremental_cursor_fingerprints ?? [])
  const candidateRecords = legacyBaseline ? [] : normalized.filter((record) =>
    !previousCursorAt
      || record.timestamp > previousCursorAt
      || (record.timestamp === previousCursorAt && !previousFingerprints.has(record.fingerprint)),
  ).map((record) => record.record)

  const newestReturnedAt = normalized.map((record) => record.timestamp).sort().at(-1) ?? null
  const cursorAt = !previousCursorAt || (newestReturnedAt && newestReturnedAt > previousCursorAt)
    ? newestReturnedAt
    : previousCursorAt
  const cursorFingerprints = new Set(
    cursorAt === previousCursorAt ? previousFingerprints : [],
  )
  for (const record of normalized) {
    if (record.timestamp === cursorAt) cursorFingerprints.add(record.fingerprint)
  }

  return {
    candidateRecords,
    cursorAt,
    cursorFingerprints: [...cursorFingerprints].sort(),
  }
}

function buildStatus({ source, receipt, previousReceipt, previousStatus, recordCount = null }) {
  const success = successfulReceipt(receipt)
  const changed = receipt.status === "changed"
  return {
    source_id: source.id,
    last_receipt_id: receipt.id,
    last_checked_at: receipt.checked_at,
    check_status: receipt.status,
    last_success_at: success ? receipt.checked_at : previousStatus?.last_success_at ?? previousReceipt?.checked_at ?? null,
    last_success_sha256: success ? receipt.sha256 : previousStatus?.last_success_sha256 ?? previousReceipt?.sha256 ?? null,
    last_change_at: changed ? receipt.checked_at : previousStatus?.last_change_at ?? (previousReceipt?.status === "changed" ? previousReceipt.checked_at : null),
    source_published_at: success ? receipt.source_published_at : previousStatus?.source_published_at ?? null,
    record_count: success ? recordCount : previousStatus?.record_count ?? null,
    consecutive_failures: success ? 0 : (previousStatus?.consecutive_failures ?? 0) + 1,
    is_stale: !success,
    stale_since: success ? null : previousStatus?.stale_since ?? receipt.checked_at,
    error_class: receipt.error_class,
    error_message: receipt.error_message,
  }
}

export async function runSourceCheck({
  source,
  runId = "manual",
  runMode = "manual_probe",
  checkedAt = new Date().toISOString(),
  previousReceipt = null,
  previousStatus = null,
  fetchImpl = globalThis.fetch,
  captureFailure = false,
}) {
  let requestUrl = source.endpoint
  let responseHeaders = null
  let httpStatus = null
  const startedAt = performance.now()

  try {
    const fetched = await fetchSourcePayload({ source, checkedAt, previousReceipt, fetchImpl })
    requestUrl = fetched.requestUrl
    responseHeaders = fetched.response.headers
    httpStatus = fetched.response.status

    if (fetched.response.status === 304) {
      if (!previousReceipt?.sha256) throw new SourceUnavailableError(`${source.id} returned 304 without a prior successful receipt.`)
      const receipt = buildReceipt({
        source,
        runId,
        runMode,
        checkedAt,
        requestUrl,
        status: "unchanged",
        httpStatus: 304,
        headers: fetched.response.headers,
        body: null,
        durationMs: fetched.durationMs,
        sourcePublishedAt: previousReceipt.source_published_at,
        previousReceiptId: previousReceipt.id,
      })
      receipt.sha256 = previousReceipt.sha256
      receipt.normalized_sha256 = previousReceipt.normalized_sha256 ?? previousReceipt.sha256
      receipt.byte_count = previousReceipt.byte_count
      if (source.comparison_mode === "incremental" && Object.hasOwn(previousReceipt, "incremental_cursor_at")) {
        receipt.incremental_cursor_at = previousReceipt.incremental_cursor_at ?? null
        receipt.incremental_cursor_fingerprints = previousReceipt.incremental_cursor_fingerprints ?? []
      }
      const status = buildStatus({ source, receipt, previousReceipt, previousStatus, recordCount: previousStatus?.record_count ?? null })
      return { receipt, candidate: null, status, rawBody: null }
    }

    if (!fetched.response.ok) throw httpError(fetched.response, source.id)

    const normalized = normalizeSourcePayload(source, fetched.body)
    if (normalized.isComplete === false) {
      throw new SchemaDriftError(`${source.id} returned a partial page; pagination must be implemented before publication.`)
    }
    if (!source.empty_response_is_valid && normalized.records.length === 0) {
      throw new UnexpectedEmptyError(`${source.id} returned zero records, which is not valid for this adapter.`)
    }

    const normalizedBody = JSON.stringify(normalized.records)
    const currentHash = hashContent(normalizedBody)
    const previousHash = previousReceipt?.normalized_sha256 ?? previousReceipt?.sha256
    const incremental = source.comparison_mode === "incremental"
      ? compareIncrementalRecords(source, normalized.records, previousReceipt, currentHash)
      : null
    const candidateRecords = incremental?.candidateRecords ?? normalized.records
    const statusName = incremental
      ? (candidateRecords.length ? "changed" : "unchanged")
      : (previousHash === currentHash ? "unchanged" : "changed")
    const receipt = buildReceipt({
      source,
      runId,
      runMode,
      checkedAt,
      requestUrl,
      status: statusName,
      httpStatus: fetched.response.status,
      headers: fetched.response.headers,
      body: fetched.body,
      normalizedBody,
      durationMs: fetched.durationMs,
      sourcePublishedAt: normalized.sourcePublishedAt,
      previousReceiptId: previousReceipt?.id ?? null,
    })
    if (incremental) {
      receipt.incremental_cursor_at = incremental.cursorAt
      receipt.incremental_cursor_fingerprints = incremental.cursorFingerprints
    }
    const candidate = statusName === "changed" ? {
      receipt_id: receipt.id,
      source_id: source.id,
      checked_at: checkedAt,
      source_published_at: normalized.sourcePublishedAt,
      sha256: receipt.normalized_sha256,
      record_count: candidateRecords.length,
      review_state: "pending",
      records: candidateRecords,
    } : null
    const status = buildStatus({ source, receipt, previousReceipt, previousStatus, recordCount: normalized.records.length })
    return { receipt, candidate, status, rawBody: fetched.body }
  } catch (error) {
    if (!captureFailure) throw error
    const receipt = buildReceipt({
      source,
      runId,
      runMode,
      checkedAt,
      requestUrl,
      status: error instanceof SourceAuthError ? "blocked_auth" : "failed",
      httpStatus: error.httpStatus ?? httpStatus,
      headers: responseHeaders,
      durationMs: Math.round(performance.now() - startedAt),
      error,
      retryAfter: error.retryAfter,
      previousReceiptId: previousReceipt?.id ?? null,
    })
    const status = buildStatus({ source, receipt, previousReceipt, previousStatus })
    return { receipt, candidate: null, status, rawBody: null, error }
  }
}
