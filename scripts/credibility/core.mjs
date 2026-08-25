import { createHash } from "node:crypto"

export class CredibilityPipelineError extends Error {
  constructor(message, options = {}) {
    const { cause, ...metadata } = options
    super(message, cause ? { cause } : undefined)
    this.name = this.constructor.name
    Object.assign(this, metadata)
  }
}

export class SourceAuthError extends CredibilityPipelineError {}
export class SourceRateLimitError extends CredibilityPipelineError {}
export class SourceTimeoutError extends CredibilityPipelineError {}
export class SourceUnavailableError extends CredibilityPipelineError {}
export class SchemaDriftError extends CredibilityPipelineError {}
export class UnexpectedEmptyError extends CredibilityPipelineError {}
export class ParseError extends CredibilityPipelineError {}
export class EntityMatchAmbiguousError extends CredibilityPipelineError {}
export class TermsBlockedError extends CredibilityPipelineError {}

export class EvidenceConflictError extends CredibilityPipelineError {
  constructor(conflicts) {
    super(`Found ${conflicts.length} unresolved evidence conflict${conflicts.length === 1 ? "" : "s"}.`)
    this.conflicts = conflicts
  }
}

const sensitiveQueryKeys = new Set([
  "api_key",
  "apikey",
  "api-key",
  "key",
  "token",
  "access_token",
  "subscription-key",
  "ocp-apim-subscription-key",
])

export function sanitizeUrl(value) {
  const url = new URL(value)
  for (const key of [...url.searchParams.keys()]) {
    if (sensitiveQueryKeys.has(key.toLowerCase())) {
      url.searchParams.set(key, "REDACTED")
    }
  }
  return url.toString()
}

export function sanitizeErrorMessage(value) {
  return String(value)
    .replace(/([?&](?:api[_-]?key|token|access_token|key)=)[^&\s]+/gi, "$1REDACTED")
    .slice(0, 500)
}

export function assertAllowedSourceUrl(value, allowedHosts) {
  const url = new URL(value)
  const allowed = allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  if (!allowed) {
    throw new TermsBlockedError(`Source host ${url.hostname} is not allowlisted.`)
  }
  if (url.protocol !== "https:") {
    throw new TermsBlockedError(`Source URL must use HTTPS: ${url.hostname}`)
  }
}

export function hashContent(value) {
  return createHash("sha256").update(value).digest("hex")
}

function getHeader(headers, name) {
  if (!headers) return null
  if (typeof headers.get === "function") return headers.get(name)
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return entry ? entry[1] : null
}

function receiptId(sourceId, checkedAt, sha256, errorClass) {
  const timestamp = checkedAt.replace(/[^0-9]/g, "").slice(0, 17)
  const suffix = sha256?.slice(0, 12) ?? errorClass?.toLowerCase().slice(0, 12) ?? "no-content"
  return `${sourceId}-${timestamp}-${suffix}`
}

export function buildReceipt({
  source,
  runId = "manual",
  runMode = "manual_probe",
  checkedAt,
  requestUrl,
  status,
  httpStatus = null,
  headers = null,
  body = null,
  normalizedBody = null,
  durationMs,
  sourcePublishedAt = null,
  error = null,
  previousReceiptId = null,
  archivePath = null,
  retryAfter = null,
}) {
  const sha256 = body === null ? null : hashContent(body)
  const normalizedSha256 = normalizedBody === null ? sha256 : hashContent(normalizedBody)
  const errorClass = error?.name ?? null
  return {
    id: receiptId(source.id, checkedAt, sha256, errorClass),
    run_id: runId,
    run_mode: runMode,
    source_id: source.id,
    checked_at: checkedAt,
    request_url: sanitizeUrl(requestUrl),
    status,
    http_status: httpStatus,
    source_published_at: sourcePublishedAt,
    etag: getHeader(headers, "etag"),
    last_modified: getHeader(headers, "last-modified"),
    content_type: getHeader(headers, "content-type"),
    retry_after: retryAfter ?? getHeader(headers, "retry-after"),
    byte_count: body === null ? 0 : Buffer.byteLength(body),
    sha256,
    normalized_sha256: normalizedSha256,
    adapter_version: source.adapter_version,
    duration_ms: durationMs,
    error_class: errorClass,
    error_message: error ? sanitizeErrorMessage(error.message) : null,
    previous_receipt_id: previousReceiptId,
    archive_path: archivePath,
  }
}

function normalizedValueKey(value) {
  return JSON.stringify(value)
}

export function trustedSupersededEventIds(events, receipts = []) {
  const receiptById = new Map(receipts.map((receipt) => [receipt.id, receipt]))
  const eventById = new Map(events.map((event) => [event.id, event]))
  return new Set(events.filter((event) => {
    if (!event.supersedes_event_id || !["reviewed", "published", "retracted"].includes(event.review_state)) return false
    const referenced = eventById.get(event.supersedes_event_id)
    if (!referenced
      || referenced.project_id !== event.project_id
      || referenced.claim_type !== event.claim_type
      || referenced.claim_key !== event.claim_key) return false
    const receipt = receiptById.get(event.retrieval_receipt_id)
    return receipt?.source_id === event.source_id
      && ["changed", "unchanged"].includes(receipt.status)
      && Boolean(receipt.sha256)
  }).map((event) => event.supersedes_event_id))
}

export function detectEvidenceConflicts(events, receipts = []) {
  const supersededIds = trustedSupersededEventIds(events, receipts)
  const currentEvents = events.filter((event) =>
    ["reviewed", "published"].includes(event.review_state) && !supersededIds.has(event.id),
  )
  const groups = new Map()

  for (const event of currentEvents) {
    const key = `${event.project_id}\u0000${event.claim_key}`
    const group = groups.get(key) ?? []
    group.push(event)
    groups.set(key, group)
  }

  const conflicts = []
  for (const [key, group] of groups) {
    const values = new Map()
    for (const event of group) {
      const valueKey = normalizedValueKey(event.normalized_value)
      const valueEvents = values.get(valueKey) ?? []
      valueEvents.push(event)
      values.set(valueKey, valueEvents)
    }
    if (values.size > 1) {
      const [projectId, claimKey] = key.split("\u0000")
      conflicts.push({
        project_id: projectId,
        claim_type: group[0].claim_type,
        claim_key: claimKey,
        event_ids: group.map((event) => event.id),
        values: [...values.keys()].map((value) => JSON.parse(value)),
      })
    }
  }

  return conflicts
}
