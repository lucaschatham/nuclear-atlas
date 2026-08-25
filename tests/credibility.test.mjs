import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"

import {
  EvidenceConflictError,
  ParseError,
  SchemaDriftError,
  SourceAuthError,
  SourceRateLimitError,
  SourceTimeoutError,
  SourceUnavailableError,
  TermsBlockedError,
  UnexpectedEmptyError,
  assertAllowedSourceUrl,
  buildReceipt,
  detectEvidenceConflicts,
  hashContent,
  sanitizeUrl,
} from "../scripts/credibility/core.mjs"
import { runSourceCheck } from "../scripts/credibility/pipeline.mjs"
import { buildRunId } from "../scripts/credibility/run.mjs"
import { normalizeSourcePayload, readResponseBody } from "../scripts/credibility/adapters.mjs"
import { buildManualReceipt } from "../scripts/credibility/record-manual.mjs"
import { buildProofStatus } from "../scripts/credibility/proof.mjs"
import { evidenceReceiptReferenceErrors, validateCredibilityData } from "../scripts/validate-credibility.mjs"

const root = new URL("../", import.meta.url)

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"))
}

test("credibility schemas validate the registry, receipts, and evidence ledger", async () => {
  const [sourceSchema, receiptSchema, evidenceSchema, sources, receipts, evidence] = await Promise.all([
    readJson("data/credibility/source-definition.schema.json"),
    readJson("data/credibility/retrieval-receipt.schema.json"),
    readJson("data/credibility/evidence-event.schema.json"),
    readJson("data/credibility/sources.json"),
    readJson("data/credibility/seed-receipts.json"),
    readJson("data/credibility/evidence-events.json"),
  ])

  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addFormats(ajv)

  for (const [schema, records] of [
    [sourceSchema, sources],
    [receiptSchema, receipts],
    [evidenceSchema, evidence],
  ]) {
    const validate = ajv.compile(schema)
    assert.equal(validate(records), true, JSON.stringify(validate.errors, null, 2))
  }

  const validateEvidence = ajv.getSchema(evidenceSchema.$id)
  for (const reviewState of ["reviewed", "published", "superseded", "retracted"]) {
    const publicWithoutReceipt = [{ ...evidence[0], review_state: reviewState, retrieval_receipt_id: null }]
    assert.equal(validateEvidence(publicWithoutReceipt), false, `${reviewState} evidence must name a receipt`)
  }
})

test("registry covers the planned source universe without automating unverified sources", async () => {
  const sources = await readJson("data/credibility/sources.json")
  const ids = new Set(sources.map((source) => source.id))

  assert.ok(sources.length >= 20)
  assert.equal(ids.size, sources.length)

  for (const required of [
    "nrc-reactor-status",
    "nrc-adams",
    "federal-register-nrc",
    "govinfo-federal-register",
    "regulations-gov-nrc",
    "usaspending-nuclear",
    "sam-opportunities-nuclear",
    "grants-gov-nuclear",
    "sec-edgar-oklo",
    "eia-nuclear",
    "osti-nuclear",
    "epa-echo",
    "usgs-water",
    "fema-national-risk-index",
    "bls-qcew",
    "iaea-nuclear-data",
  ]) {
    assert.ok(ids.has(required), `Missing source family: ${required}`)
  }

  for (const source of sources) {
    if (source.operational_state === "approved_automated") {
      assert.ok(source.adapter, `${source.id} is automated without an adapter`)
      assert.ok(source.allowed_hosts.length >= 1, `${source.id} has no host allowlist`)
      assert.notEqual(source.access_method, "html")
      assert.notEqual(source.access_method, "pdf")
    }
    if (source.comparison_mode === "incremental") {
      assert.ok(source.incremental_record_id_path, `${source.id} lacks an incremental record identifier`)
      assert.ok(source.incremental_record_timestamp_path, `${source.id} lacks an incremental record timestamp`)
    }
  }

  const usaSpending = sources.find((source) => source.id === "usaspending-nuclear")
  assert.equal(usaSpending.request.body.filters.time_period[0].date_type, "last_modified_date")
  assert.ok(usaSpending.request.body.fields.includes("Last Modified Date"))
})

test("pilot evidence stays append-only and references known projects and sources", async () => {
  const [deals, sources, pilots, evidence] = await Promise.all([
    readJson("data/deals.json"),
    readJson("data/credibility/sources.json"),
    readJson("data/credibility/pilot-projects.json"),
    readJson("data/credibility/evidence-events.json"),
  ])

  const expectedPilots = [
    "google-tva-kairos-hermes-2",
    "microsoft-constellation-crane-restart",
    "amazon-talen-susquehanna-ppa",
    "amazon-energy-northwest-cascade",
    "meta-oklo-pike-county-campus",
  ]

  assert.deepEqual(pilots.map((pilot) => pilot.project_id), expectedPilots)

  const projectIds = new Set(deals.map((deal) => deal.id))
  const sourceIds = new Set(sources.map((source) => source.id))
  const eventIds = new Set()

  for (const event of evidence) {
    assert.ok(projectIds.has(event.project_id), `Unknown project: ${event.project_id}`)
    assert.ok(sourceIds.has(event.source_id), `Unknown source: ${event.source_id}`)
    assert.equal(eventIds.has(event.id), false, `Duplicate evidence ID: ${event.id}`)
    eventIds.add(event.id)
  }
})

test("source URLs are allowlisted and credentials are redacted", () => {
  assert.equal(
    sanitizeUrl("https://api.example.gov/records?api_key=secret&query=nuclear&token=also-secret"),
    "https://api.example.gov/records?api_key=REDACTED&query=nuclear&token=REDACTED",
  )

  assert.doesNotThrow(() => assertAllowedSourceUrl("https://api.example.gov/records", ["api.example.gov"]))
  assert.throws(
    () => assertAllowedSourceUrl("https://attacker.example/records", ["api.example.gov"]),
    /not allowlisted/,
  )
})

test("the rolling review workflow merges the current default branch without rewriting review history", async () => {
  const workflow = await readFile(new URL(".github/workflows/credibility-daily.yml", root), "utf8")
  assert.match(workflow, /DEFAULT_BRANCH:/)
  assert.match(workflow, /gh pr list --head "\$REVIEW_BRANCH" --state open/)
  assert.match(workflow, /git push origin --delete "\$REVIEW_BRANCH"/)
  assert.match(workflow, /git switch -C "\$REVIEW_BRANCH" "origin\/\$DEFAULT_BRANCH"/)
  assert.match(workflow, /git merge --no-edit "origin\/\$DEFAULT_BRANCH"/)
  assert.doesNotMatch(workflow, /git push .*--force/)
})

test("NRC reactor status rejects nonnumeric and out-of-range power values", () => {
  const source = { id: "nrc-test", adapter: "nrc_reactor_status", minimum_record_count: 2 }
  for (const power of ["unknown", "-1", "101"]) {
    assert.throws(
      () => normalizeSourcePayload(source, `ReportDt|Unit|Power\n08/25/2026|Test Unit|${power}`),
      SchemaDriftError,
    )
  }
  assert.throws(
    () => normalizeSourcePayload(source, "ReportDt|Unit|Power\n08/25/2026|Only Unit|100"),
    SchemaDriftError,
  )
})

test("response limits cancel chunked bodies before the full payload is buffered", async () => {
  let reads = 0
  let cancelled = false
  const chunks = [Buffer.alloc(40), Buffer.alloc(40), Buffer.alloc(40)]
  const response = {
    headers: new Headers(),
    body: {
      getReader() {
        return {
          async read() {
            const value = chunks[reads]
            reads += 1
            return value ? { done: false, value } : { done: true, value: undefined }
          },
          async cancel() { cancelled = true },
          releaseLock() {},
        }
      },
    },
  }

  await assert.rejects(() => readResponseBody(response, 64, "stream-test"), ParseError)
  assert.equal(reads, 2)
  assert.equal(cancelled, true)
})

test("GitHub reruns receive distinct proof run IDs", () => {
  const checkedAt = "2026-08-25T12:00:00.000Z"
  assert.equal(buildRunId({ checkedAt, env: { GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1" } }), "github-123-1")
  assert.equal(buildRunId({ checkedAt, env: { GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "2" } }), "github-123-2")
  assert.match(buildRunId({ checkedAt, env: {} }), /^local-/)
})

test("source redirects stay inside the registered host allowlist", async () => {
  const source = {
    id: "redirect-source",
    endpoint: "https://api.example.gov/records",
    allowed_hosts: ["api.example.gov"],
    auth_method: "none",
    adapter: "json_records",
    adapter_version: "1.0.0",
    empty_response_is_valid: true,
    accepted_content_types: ["application/json"],
    timeout_ms: 30000,
    maximum_response_bytes: 1000,
    request: { method: "GET" },
  }
  const redirectModes = []
  const allowed = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T12:00:00.000Z",
    fetchImpl: async (url, init) => {
      redirectModes.push(init.redirect)
      if (url === "https://api.example.gov/records") return new Response(null, { status: 302, headers: { location: "/v2/records" } })
      return new Response('{"records":[{"id":"one"}]}', { status: 200, headers: { "content-type": "application/json" } })
    },
  })
  assert.equal(allowed.receipt.request_url, "https://api.example.gov/v2/records")
  assert.deepEqual(redirectModes, ["manual", "manual"])

  const blocked = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T13:00:00.000Z",
    captureFailure: true,
    fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://attacker.example/records" } }),
  })
  assert.equal(blocked.error instanceof TermsBlockedError, true)
})

test("manual evidence capture hashes a reviewer supplied file without fetching its URL", () => {
  const source = {
    id: "manual-source",
    endpoint: "https://records.example.gov/",
    allowed_hosts: ["records.example.gov"],
    adapter_version: "manual-1.0.0",
    maximum_response_bytes: 1000,
  }
  const first = buildManualReceipt({
    source,
    documentUrl: "https://records.example.gov/document/one",
    body: Buffer.from("reviewed document"),
    contentType: "application/pdf",
    checkedAt: "2026-08-25T12:00:00.000Z",
    sourcePublishedAt: "2026-08-24T00:00:00.000Z",
  })
  const repeated = buildManualReceipt({
    source,
    documentUrl: "https://records.example.gov/document/one",
    body: Buffer.from("reviewed document"),
    contentType: "application/pdf",
    checkedAt: "2026-08-26T12:00:00.000Z",
    sourcePublishedAt: "2026-08-24T00:00:00.000Z",
    previousReceipt: first,
  })

  assert.equal(first.status, "changed")
  assert.equal(first.http_status, null)
  assert.equal(first.content_type, "application/pdf")
  assert.equal(first.byte_count, Buffer.byteLength("reviewed document"))
  assert.equal(repeated.status, "unchanged")
  assert.equal(repeated.previous_receipt_id, first.id)
  assert.throws(() => buildManualReceipt({
    source,
    documentUrl: "https://attacker.example/document/one",
    body: Buffer.from("reviewed document"),
    contentType: "application/pdf",
    checkedAt: "2026-08-25T12:00:00.000Z",
  }), /not allowlisted/)
})

test("receipts preserve source-native timestamps and deterministic hashes", () => {
  const body = "official source payload"
  const receipt = buildReceipt({
    source: {
      id: "test-source",
      adapter_version: "1.0.0",
    },
    checkedAt: "2026-08-25T12:00:00.000Z",
    requestUrl: "https://api.example.gov/records?api_key=secret",
    status: "changed",
    httpStatus: 200,
    headers: {
      "content-type": "application/json",
      etag: '"abc"',
      "last-modified": "Mon, 24 Aug 2026 12:00:00 GMT",
    },
    body,
    durationMs: 42,
    sourcePublishedAt: "2026-08-24T12:00:00.000Z",
  })

  assert.equal(receipt.sha256, hashContent(body))
  assert.equal(receipt.normalized_sha256, hashContent(body))
  assert.equal(receipt.source_published_at, "2026-08-24T12:00:00.000Z")
  assert.equal(receipt.request_url, "https://api.example.gov/records?api_key=REDACTED")
  assert.equal(receipt.byte_count, Buffer.byteLength(body))
})

test("volatile API metadata does not create a false source change", async () => {
  const source = {
    id: "test-grants-source",
    publisher: "Test Agency",
    authority_class: "official_government",
    geographic_scope: ["US"],
    endpoint: "https://api.example.gov/grants",
    allowed_hosts: ["api.example.gov"],
    access_method: "api",
    auth_method: "none",
    terms_url: "https://api.example.gov/terms",
    archival_policy: "record_snapshot",
    expected_cadence: "daily",
    polling_interval_hours: 24,
    supported_claim_types: ["federal_support"],
    adapter: "grants_gov",
    adapter_version: "1.0.0",
    operational_state: "approved_automated",
    empty_response_is_valid: false,
    timeout_ms: 30000,
    maximum_response_bytes: 1000000,
    request: { method: "GET" },
  }
  const payload = (token) => JSON.stringify({
    token,
    data: { hitCount: 1, oppHits: [{ id: "grant-1", openDate: "08/25/2026" }] },
  })

  const first = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T12:00:00.000Z",
    fetchImpl: async () => new Response(payload("volatile-a"), { status: 200 }),
  })
  const second = await runSourceCheck({
    source,
    checkedAt: "2026-08-26T12:00:00.000Z",
    previousReceipt: first.receipt,
    fetchImpl: async () => new Response(payload("volatile-b"), { status: 200 }),
  })

  assert.notEqual(first.receipt.sha256, second.receipt.sha256)
  assert.equal(first.receipt.normalized_sha256, second.receipt.normalized_sha256)
  assert.equal(second.receipt.status, "unchanged")
  assert.equal(second.receipt.source_published_at, null)
})

test("daily checks distinguish changed, unchanged, unexpected empty, and failed sources", async () => {
  const source = {
    id: "test-json-source",
    publisher: "Test Agency",
    authority_class: "official_government",
    geographic_scope: ["US"],
    endpoint: "https://api.example.gov/records",
    allowed_hosts: ["api.example.gov"],
    access_method: "api",
    auth_method: "none",
    terms_url: "https://api.example.gov/terms",
    archival_policy: "record_snapshot",
    expected_cadence: "daily",
    polling_interval_hours: 24,
    supported_claim_types: ["schedule"],
    adapter: "json_records",
    adapter_version: "1.0.0",
    operational_state: "approved_automated",
    empty_response_is_valid: false,
    timeout_ms: 30000,
    maximum_response_bytes: 1000000,
    request: { method: "GET" },
  }

  const first = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T12:00:00.000Z",
    fetchImpl: async () => new Response('{"records":[{"id":"one"}]}', {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  })
  assert.equal(first.receipt.status, "changed")
  assert.equal(first.candidate.record_count, 1)
  assert.equal(first.status.is_stale, false)

  const second = await runSourceCheck({
    source,
    checkedAt: "2026-08-26T12:00:00.000Z",
    previousReceipt: first.receipt,
    fetchImpl: async () => new Response('{"records":[{"id":"one"}]}', {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  })
  assert.equal(second.receipt.status, "unchanged")

  await assert.rejects(
    () => runSourceCheck({
      source,
      checkedAt: "2026-08-27T12:00:00.000Z",
      previousReceipt: second.receipt,
      fetchImpl: async () => new Response('{"records":[]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    }),
    UnexpectedEmptyError,
  )

  const failed = await runSourceCheck({
    source,
    checkedAt: "2026-08-28T12:00:00.000Z",
    previousReceipt: second.receipt,
    fetchImpl: async () => new Response("temporarily unavailable", { status: 503 }),
    captureFailure: true,
  })
  assert.equal(failed.receipt.status, "failed")
  assert.equal(failed.status.last_success_at, second.receipt.checked_at)
  assert.equal(failed.status.last_success_sha256, second.receipt.sha256)
  assert.equal(failed.status.is_stale, true)
  assert.equal(failed.status.stale_since, failed.receipt.checked_at)
})

test("incremental sources emit only non-empty new review candidates", async () => {
  const source = {
    id: "test-incremental-source",
    endpoint: "https://api.example.gov/records",
    allowed_hosts: ["api.example.gov"],
    auth_method: "none",
    adapter: "json_records",
    adapter_version: "1.0.0",
    comparison_mode: "incremental",
    incremental_record_id_path: "id",
    incremental_record_timestamp_path: "updated_at",
    empty_response_is_valid: true,
    timeout_ms: 30000,
    maximum_response_bytes: 1000000,
    request: { method: "GET" },
  }
  const response = (records) => new Response(JSON.stringify({ records }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
  const legacyRecords = [{ id: "legacy", updated_at: "2026-08-24T12:00:00.000Z" }]
  const legacyReceipt = {
    id: "legacy-receipt",
    checked_at: "2026-08-24T13:00:00.000Z",
    normalized_sha256: hashContent(JSON.stringify(legacyRecords)),
    sha256: "a".repeat(64),
  }
  const bootstrapped = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T11:00:00.000Z",
    previousReceipt: legacyReceipt,
    fetchImpl: async () => response(legacyRecords),
  })
  assert.equal(bootstrapped.receipt.status, "unchanged")
  assert.equal(bootstrapped.candidate, null)
  assert.equal(bootstrapped.receipt.incremental_cursor_at, "2026-08-24T12:00:00.000Z")

  await assert.rejects(
    () => runSourceCheck({
      source,
      checkedAt: "2026-08-25T11:30:00.000Z",
      previousReceipt: legacyReceipt,
      fetchImpl: async () => response([...legacyRecords, { id: "unknown", updated_at: "2026-08-25T10:00:00.000Z" }]),
    }),
    SchemaDriftError,
  )

  const first = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T12:00:00.000Z",
    fetchImpl: async () => response([
      { id: "old", updated_at: "2026-08-18T12:00:00.000Z" },
      { id: "one", updated_at: "2026-08-25T12:00:00.000Z" },
    ]),
  })
  assert.equal(first.receipt.status, "changed")
  assert.equal(first.candidate.record_count, 2)

  const repeated = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T13:00:00.000Z",
    previousReceipt: first.receipt,
    fetchImpl: async () => response([
      { id: "one", updated_at: "2026-08-25T12:00:00.000Z" },
    ]),
  })
  assert.equal(repeated.receipt.status, "unchanged")
  assert.equal(repeated.candidate, null)

  const sameTimestampAddition = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T14:00:00.000Z",
    previousReceipt: repeated.receipt,
    fetchImpl: async () => response([
      { id: "one", updated_at: "2026-08-25T12:00:00.000Z" },
      { id: "two", updated_at: "2026-08-25T12:00:00.000Z" },
    ]),
  })
  assert.equal(sameTimestampAddition.receipt.status, "changed")
  assert.deepEqual(sameTimestampAddition.candidate.records.map((record) => record.id), ["two"])

  const empty = await runSourceCheck({
    source,
    checkedAt: "2026-08-26T12:00:00.000Z",
    previousReceipt: sameTimestampAddition.receipt,
    fetchImpl: async () => response([]),
  })
  assert.equal(empty.receipt.status, "unchanged")
  assert.equal(empty.candidate, null)
})

test("adapter failures map to named receipt errors without erasing prior success", async () => {
  const source = {
    id: "test-contract-source",
    endpoint: "https://api.example.gov/records",
    allowed_hosts: ["api.example.gov"],
    auth_method: "none",
    adapter: "json_records",
    adapter_version: "1.0.0",
    empty_response_is_valid: true,
    accepted_content_types: ["application/json"],
    timeout_ms: 30000,
    maximum_response_bytes: 64,
    request: { method: "GET" },
  }
  const previousReceipt = buildReceipt({
    source,
    checkedAt: "2026-08-24T12:00:00.000Z",
    requestUrl: source.endpoint,
    status: "unchanged",
    httpStatus: 200,
    headers: { "content-type": "application/json" },
    body: '{"records":[]}',
    durationMs: 1,
  })
  const cases = [
    [401, SourceAuthError],
    [403, SourceAuthError],
    [404, SourceUnavailableError],
    [429, SourceRateLimitError],
    [503, SourceUnavailableError],
  ]

  for (const [status, ErrorClass] of cases) {
    const result = await runSourceCheck({
      source,
      checkedAt: `2026-08-25T12:${String(status % 60).padStart(2, "0")}:00.000Z`,
      previousReceipt,
      captureFailure: true,
      fetchImpl: async () => new Response("failure", {
        status,
        headers: status === 429 ? { "retry-after": "120" } : {},
      }),
    })
    assert.equal(result.error instanceof ErrorClass, true, `HTTP ${status} used ${result.error?.name}`)
    assert.equal(result.status.last_success_at, previousReceipt.checked_at)
    if (status === 429) assert.equal(result.receipt.retry_after, "120")
  }

  const timeout = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T13:00:00.000Z",
    previousReceipt,
    captureFailure: true,
    fetchImpl: async () => {
      const error = new Error("timed out")
      error.name = "TimeoutError"
      throw error
    },
  })
  assert.equal(timeout.error instanceof SourceTimeoutError, true)

  const network = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T14:00:00.000Z",
    previousReceipt,
    captureFailure: true,
    fetchImpl: async () => { throw new TypeError("fetch failed") },
  })
  assert.equal(network.error instanceof SourceUnavailableError, true)

  const malformed = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T15:00:00.000Z",
    previousReceipt,
    captureFailure: true,
    fetchImpl: async () => new Response('{"records":[', {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  })
  assert.equal(malformed.error instanceof ParseError, true)

  const schemaDrift = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T15:30:00.000Z",
    previousReceipt,
    captureFailure: true,
    fetchImpl: async () => new Response('{"unexpected":[]}', {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  })
  assert.equal(schemaDrift.error instanceof SchemaDriftError, true)

  const wrongType = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T16:00:00.000Z",
    previousReceipt,
    captureFailure: true,
    fetchImpl: async () => new Response('{"records":[]}', {
      status: 200,
      headers: { "content-type": "text/html" },
    }),
  })
  assert.equal(wrongType.error instanceof ParseError, true)

  const oversized = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T17:00:00.000Z",
    previousReceipt,
    captureFailure: true,
    fetchImpl: async () => new Response(JSON.stringify({ records: [{ value: "x".repeat(100) }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  })
  assert.equal(oversized.error instanceof ParseError, true)

  const notModified = await runSourceCheck({
    source,
    checkedAt: "2026-08-25T18:00:00.000Z",
    previousReceipt,
    fetchImpl: async () => new Response(null, { status: 304 }),
  })
  assert.equal(notModified.receipt.status, "unchanged")
  assert.equal(notModified.receipt.sha256, previousReceipt.sha256)
})

test("conflicting reviewed claims are blocked instead of silently resolved", () => {
  const receipts = [
    { id: "receipt-1", source_id: "official-source", status: "changed", sha256: "a".repeat(64) },
  ]
  const shared = {
    project_id: "pilot-project",
    claim_type: "schedule",
    claim_key: "schedule.commercial-operation-date",
    unit: null,
    source_id: "official-source",
    document_url: "https://example.gov/record",
    source_document_id: "record-1",
    source_locator: "page 1",
    published_at: "2026-08-25",
    effective_at: "2026-08-25",
    retrieved_at: "2026-08-25T12:00:00.000Z",
    retrieval_receipt_id: "receipt-1",
    authority_class: "official_government",
    review_state: "reviewed",
    supersedes_event_id: null,
  }

  const conflicts = detectEvidenceConflicts([
    { ...shared, id: "event-a", normalized_value: "2028" },
    { ...shared, id: "event-b", source_document_id: "record-2", normalized_value: "2030" },
  ], receipts)

  assert.equal(conflicts.length, 1)
  assert.throws(() => {
    if (conflicts.length) throw new EvidenceConflictError(conflicts)
  }, EvidenceConflictError)

  const corrected = detectEvidenceConflicts([
    { ...shared, id: "event-a", normalized_value: "2028" },
    { ...shared, id: "event-b", normalized_value: "2030", supersedes_event_id: "event-a" },
  ], receipts)
  assert.deepEqual(corrected, [])

  const retracted = detectEvidenceConflicts([
    { ...shared, id: "event-a", normalized_value: "2028", review_state: "retracted" },
    { ...shared, id: "event-b", normalized_value: "2030" },
  ], receipts)
  assert.deepEqual(retracted, [])

  const independentClaims = detectEvidenceConflicts([
    { ...shared, id: "event-a", claim_key: "schedule.construction-start-date", normalized_value: "2028" },
    { ...shared, id: "event-b", normalized_value: "2030" },
  ], receipts)
  assert.deepEqual(independentClaims, [])

  const unrelatedSuccessor = detectEvidenceConflicts([
    { ...shared, id: "event-a", normalized_value: "2028" },
    { ...shared, id: "event-b", normalized_value: "2030" },
    { ...shared, id: "event-c", claim_key: "schedule.construction-start-date", normalized_value: "2027", supersedes_event_id: "event-a" },
  ], receipts)
  assert.equal(unrelatedSuccessor.length, 1)

  const unreviewedSuccessor = detectEvidenceConflicts([
    { ...shared, id: "event-a", normalized_value: "2028" },
    { ...shared, id: "event-b", normalized_value: "2030" },
    { ...shared, id: "event-c", normalized_value: "2030", review_state: "observed", supersedes_event_id: "event-a" },
  ], receipts)
  assert.equal(unreviewedSuccessor.length, 1)

  const failedReceiptSuccessor = detectEvidenceConflicts([
    { ...shared, id: "event-a", normalized_value: "2028" },
    { ...shared, id: "event-b", normalized_value: "2030" },
    { ...shared, id: "event-c", normalized_value: "2030", supersedes_event_id: "event-a", retrieval_receipt_id: "receipt-failed" },
  ], [
    ...receipts,
    { id: "receipt-failed", source_id: "official-source", status: "failed", sha256: null },
  ])
  assert.equal(failedReceiptSuccessor.length, 1)
})

test("evidence receipts must exist and belong to the event source", () => {
  const receipts = [
    { id: "receipt-a", source_id: "source-a", status: "changed", sha256: "a".repeat(64) },
    { id: "receipt-b", source_id: "source-b", status: "unchanged", sha256: "b".repeat(64) },
    { id: "receipt-failed", source_id: "source-a", status: "failed", sha256: null },
  ]
  const errors = evidenceReceiptReferenceErrors({
    evidence: [
      { id: "event-valid", source_id: "source-a", retrieval_receipt_id: "receipt-a" },
      { id: "event-mismatch", source_id: "source-a", retrieval_receipt_id: "receipt-b" },
      { id: "event-missing", source_id: "source-a", retrieval_receipt_id: "receipt-missing" },
      { id: "event-failed", source_id: "source-a", retrieval_receipt_id: "receipt-failed" },
    ],
    receipts,
  })

  assert.deepEqual(errors, [
    "evidence/event-mismatch receipt receipt-b belongs to source-b, not source-a",
    "evidence/event-missing unknown receipt: receipt-missing",
    "evidence/event-failed receipt receipt-failed is not a successful content-bearing retrieval",
  ])
})

test("full credibility validation reports referential and conflict errors", async () => {
  const result = await validateCredibilityData({ rootUrl: root })
  assert.deepEqual(result.errors, [])
  assert.ok(result.sourceCount >= 20)
  assert.ok(result.sourceProbeCount >= 12)
  assert.equal(result.pilotCount, 5)
})

test("the proof gate requires fourteen complete runs, traceable evidence, audits, and bounded review time", () => {
  const sources = ["source-a", "source-b"].map((id) => ({
    id,
    operational_state: "approved_automated",
    terms_url: `https://example.gov/${id}/terms`,
  }))
  const receipts = []
  for (let day = 1; day <= 14; day += 1) {
    const checkedAt = `2026-08-${String(day).padStart(2, "0")}T12:00:00.000Z`
    for (const source of sources) {
      receipts.push({
        id: `${source.id}-${day}`,
        run_id: `github-${day}`,
        run_mode: "scheduled",
        source_id: source.id,
        checked_at: checkedAt,
        status: "unchanged",
        sha256: "a".repeat(64),
      })
    }
  }
  const evidence = Array.from({ length: 20 }, (_, index) => ({
    id: `event-${index}`,
    project_id: `pilot-${index % 5}`,
    source_id: receipts[index].source_id,
    claim_type: "schedule",
    claim_key: `schedule.milestone-${index}`,
    review_state: "reviewed",
    retrieval_receipt_id: receipts[index].id,
  }))
  const pilots = Array.from({ length: 5 }, (_, index) => ({ project_id: `pilot-${index}` }))
  const eventIds = evidence.map((event) => event.id)
  const reviews = [
    { date: "2026-08-12", review_minutes: 28, claims_audited: 10, claims_reproduced: 10, audited_event_ids: eventIds.slice(0, 10), reproduced_event_ids: eventIds.slice(0, 10), critical_errors_published: 0, scenario_tests: { outage: true, correction: true, retraction: true, conflict: true, schema_drift: true } },
    { date: "2026-08-13", review_minutes: 24, claims_audited: 5, claims_reproduced: 5, audited_event_ids: eventIds.slice(10, 15), reproduced_event_ids: eventIds.slice(10, 15), critical_errors_published: 0, scenario_tests: { outage: false, correction: false, retraction: false, conflict: false, schema_drift: false } },
    { date: "2026-08-14", review_minutes: 20, claims_audited: 5, claims_reproduced: 5, audited_event_ids: eventIds.slice(15, 20), reproduced_event_ids: eventIds.slice(15, 20), critical_errors_published: 0, scenario_tests: { outage: false, correction: false, retraction: false, conflict: false, schema_drift: false } },
  ]

  const passed = buildProofStatus({ sources, receipts, evidence, pilots, reviews, generatedAt: "2026-08-14T13:00:00.000Z" })
  assert.equal(passed.gate_passed, true)

  const incomplete = buildProofStatus({ sources, receipts: receipts.slice(0, -1), evidence, pilots, reviews, generatedAt: "2026-08-14T13:00:00.000Z" })
  assert.equal(incomplete.gate_passed, false)
  assert.equal(incomplete.criteria.complete_daily_runs.passed, false)

  const failedReceipts = receipts.map((receipt) => ({ ...receipt }))
  failedReceipts.at(-1).status = "failed"
  const failed = buildProofStatus({ sources, receipts: failedReceipts, evidence, pilots, reviews, generatedAt: "2026-08-14T13:00:00.000Z" })
  assert.equal(failed.gate_passed, false)
  assert.deepEqual(failed.run_summaries.at(-1).failed_source_ids, ["source-b"])

  const recovered = buildProofStatus({
    sources,
    receipts: [
      { id: "old-failure", run_id: "github-old", run_mode: "scheduled", source_id: "source-a", checked_at: "2026-07-31T12:00:00.000Z", status: "failed" },
      ...receipts,
    ],
    evidence,
    pilots,
    reviews,
    generatedAt: "2026-08-14T13:00:00.000Z",
  })
  assert.equal(recovered.gate_passed, true)

  const minimalEvidence = evidence.slice(0, 5)
  const mismatchedEvidence = minimalEvidence.map((event, index) => index === 0 ? { ...event, source_id: "source-b" } : event)
  const mismatched = buildProofStatus({ sources, receipts, evidence: mismatchedEvidence, pilots, reviews, generatedAt: "2026-08-14T13:00:00.000Z" })
  assert.equal(mismatched.criteria.pilot_claim_traceability.passed, false)
  assert.equal(mismatched.criteria.pilot_claim_traceability.traceable_projects, 4)

  const currentFailure = buildProofStatus({
    sources,
    receipts: [
      ...receipts,
      { id: "current-a", run_id: "github-current", run_mode: "scheduled", source_id: "source-a", checked_at: "2026-08-15T12:00:00.000Z", status: "unchanged" },
      { id: "current-b", run_id: "github-current", run_mode: "scheduled", source_id: "source-b", checked_at: "2026-08-15T12:00:00.000Z", status: "failed" },
    ],
    evidence,
    pilots,
    reviews,
    generatedAt: "2026-08-15T13:00:00.000Z",
  })
  assert.equal(currentFailure.gate_passed, false)
  assert.equal(currentFailure.criteria.complete_daily_runs.consecutive_complete_days, 0)

  const stale = buildProofStatus({ sources, receipts, evidence, pilots, reviews, generatedAt: "2026-08-16T13:00:00.000Z" })
  assert.equal(stale.gate_passed, false)
  assert.equal(stale.criteria.complete_daily_runs.latest_run_current, false)

  const retractedEvidence = minimalEvidence.map((event, index) => index === 0 ? { ...event, review_state: "retracted" } : event)
  const retracted = buildProofStatus({ sources, receipts, evidence: retractedEvidence, pilots, reviews, generatedAt: "2026-08-14T13:00:00.000Z" })
  assert.equal(retracted.criteria.pilot_claim_traceability.traceable_projects, 4)

  const supersededEvidence = [
    ...minimalEvidence,
    { ...minimalEvidence[0], id: "event-retraction", review_state: "retracted", supersedes_event_id: minimalEvidence[0].id },
  ]
  const superseded = buildProofStatus({ sources, receipts, evidence: supersededEvidence, pilots, reviews, generatedAt: "2026-08-14T13:00:00.000Z" })
  assert.equal(superseded.criteria.pilot_claim_traceability.traceable_projects, 4)

  const observedSuccessor = [
    ...minimalEvidence,
    { ...minimalEvidence[0], id: "event-observed", review_state: "observed", supersedes_event_id: minimalEvidence[0].id },
  ]
  const observed = buildProofStatus({ sources, receipts, evidence: observedSuccessor, pilots, reviews, generatedAt: "2026-08-14T13:00:00.000Z" })
  assert.equal(observed.criteria.pilot_claim_traceability.traceable_projects, 5)

  const failedReceiptSuccessor = [
    ...minimalEvidence,
    { ...minimalEvidence[0], id: "event-failed", retrieval_receipt_id: "failed-successor", supersedes_event_id: minimalEvidence[0].id },
  ]
  const failedSuccessor = buildProofStatus({
    sources,
    receipts: [...receipts, { id: "failed-successor", source_id: minimalEvidence[0].source_id, status: "failed", sha256: null }],
    evidence: failedReceiptSuccessor,
    pilots,
    reviews,
    generatedAt: "2026-08-14T13:00:00.000Z",
  })
  assert.equal(failedSuccessor.criteria.pilot_claim_traceability.traceable_projects, 5)
})

test("proof runs exclude local attempts that were mislabeled as scheduled", () => {
  const status = buildProofStatus({
    sources: [{ id: "source-a", operational_state: "approved_automated", terms_url: "https://example.gov/terms" }],
    receipts: [{
      id: "receipt-a",
      run_id: "local-prelaunch",
      run_mode: "scheduled",
      source_id: "source-a",
      checked_at: "2026-08-25T12:00:00.000Z",
      status: "unchanged",
    }],
    evidence: [],
    pilots: [],
    reviews: [],
  })

  assert.equal(status.run_summaries.length, 0)
  assert.deepEqual(status.excluded_scheduled_run_ids, ["local-prelaunch"])
})

test("public evidence output excludes unreviewed observations", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "nuclear-notebook-credibility-"))
  const inputPath = join(temporaryDirectory, "events.json")
  await writeFile(inputPath, JSON.stringify([
    { id: "observed", review_state: "observed" },
    { id: "reviewed", review_state: "reviewed" },
    { id: "published", review_state: "published" },
    { id: "conflicting", review_state: "conflicting" },
  ]))

  const events = JSON.parse(await readFile(inputPath, "utf8"))
  const publicEvents = events.filter((event) => ["reviewed", "published", "superseded", "retracted"].includes(event.review_state))

  assert.deepEqual(publicEvents.map((event) => event.id), ["reviewed", "published"])
})
