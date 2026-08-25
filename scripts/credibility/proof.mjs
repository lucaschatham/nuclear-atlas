import { readFile, readdir } from "node:fs/promises"
import process from "node:process"

import { trustedSupersededEventIds } from "./core.mjs"

const defaultRoot = new URL("../../", import.meta.url)

function trailingCompleteDateCount(runSummaries) {
  const latestRunByDate = new Map()
  for (const run of runSummaries) latestRunByDate.set(run.date, run)
  const dailyRuns = [...latestRunByDate.values()].sort((a, b) => b.date.localeCompare(a.date))
  let count = 0
  let previousDay = null
  for (const run of dailyRuns) {
    const day = Date.parse(`${run.date}T00:00:00.000Z`) / 86400000
    if (!run.complete || (previousDay !== null && day !== previousDay - 1)) break
    count += 1
    previousDay = day
  }
  return count
}

export function buildProofStatus({ sources, receipts, evidence, pilots, reviews, generatedAt = new Date().toISOString() }) {
  const approvedSourceIds = sources
    .filter((source) => source.operational_state === "approved_automated")
    .map((source) => source.id)
    .sort()
  const scheduledReceipts = receipts.filter((receipt) => receipt.run_mode === "scheduled" && receipt.run_id.startsWith("github-"))
  const excludedScheduledRunIds = [...new Set(
    receipts
      .filter((receipt) => receipt.run_mode === "scheduled" && !receipt.run_id.startsWith("github-"))
      .map((receipt) => receipt.run_id),
  )].sort()
  const runs = new Map()
  for (const receipt of scheduledReceipts) {
    const run = runs.get(receipt.run_id) ?? { date: receipt.checked_at.slice(0, 10), receipts: [] }
    run.receipts.push(receipt)
    runs.set(receipt.run_id, run)
  }
  const runSummaries = [...runs.entries()].map(([runId, run]) => {
    const receiptsBySource = new Map()
    for (const receipt of run.receipts) {
      const sourceReceipts = receiptsBySource.get(receipt.source_id) ?? []
      sourceReceipts.push(receipt)
      receiptsBySource.set(receipt.source_id, sourceReceipts)
    }
    const missingSourceIds = approvedSourceIds.filter((sourceId) => !receiptsBySource.has(sourceId))
    const failedSourceIds = approvedSourceIds.filter((sourceId) =>
      receiptsBySource.get(sourceId)?.some((receipt) => !["changed", "unchanged"].includes(receipt.status)),
    )
    const duplicateSourceIds = approvedSourceIds.filter((sourceId) => (receiptsBySource.get(sourceId)?.length ?? 0) > 1)
    return {
      run_id: runId,
      date: run.date,
      checked_at: run.receipts.map((receipt) => receipt.checked_at).sort().at(-1),
      receipt_count: run.receipts.length,
      missing_source_ids: missingSourceIds,
      failed_source_ids: failedSourceIds,
      duplicate_source_ids: duplicateSourceIds,
      complete: missingSourceIds.length === 0 && failedSourceIds.length === 0 && duplicateSourceIds.length === 0,
    }
  }).sort((a, b) => a.checked_at.localeCompare(b.checked_at))
  const consecutiveRuns = trailingCompleteDateCount(runSummaries)
  const latestScheduledAt = runSummaries.at(-1)?.checked_at ?? null
  const latestRunAgeHours = latestScheduledAt
    ? (Date.parse(generatedAt) - Date.parse(latestScheduledAt)) / 3600000
    : null
  const latestRunCurrent = latestRunAgeHours !== null
    && Number.isFinite(latestRunAgeHours)
    && latestRunAgeHours >= 0
    && latestRunAgeHours <= 24

  const pilotIds = new Set(pilots.map((pilot) => pilot.project_id))
  const receiptById = new Map(receipts.map((receipt) => [receipt.id, receipt]))
  const eventById = new Map(evidence.map((event) => [event.id, event]))
  const hasSuccessfulMatchingReceipt = (event) => {
    const receipt = receiptById.get(event?.retrieval_receipt_id)
    if (!event || !receipt) return false

    return receipt.source_id === event.source_id
      && ["changed", "unchanged"].includes(receipt.status)
      && Boolean(receipt.sha256)
  }
  const supersededEventIds = trustedSupersededEventIds(evidence, receipts)
  const isCurrentTraceableEvent = (event) => {
    return hasSuccessfulMatchingReceipt(event)
      && ["reviewed", "published"].includes(event.review_state)
      && !supersededEventIds.has(event.id)
  }
  const pilotEvents = evidence.filter((event) => pilotIds.has(event.project_id))
  const traceablePilotIds = new Set(
    pilotEvents
      .filter(isCurrentTraceableEvent)
      .map((event) => event.project_id),
  )

  const auditedEventIds = new Set(reviews.flatMap((review) => review.audited_event_ids ?? []))
  const reproducedEventIds = new Set(reviews.flatMap((review) => review.reproduced_event_ids ?? []))
  const validAuditedEventIds = new Set([...auditedEventIds].filter((eventId) => isCurrentTraceableEvent(eventById.get(eventId))))
  const validReproducedEventIds = new Set(
    [...reproducedEventIds].filter((eventId) => validAuditedEventIds.has(eventId) && isCurrentTraceableEvent(eventById.get(eventId))),
  )
  const claimsAudited = validAuditedEventIds.size
  const claimsReproduced = validReproducedEventIds.size
  const scenarioNames = ["outage", "correction", "retraction", "conflict", "schema_drift"]
  const scenarios = Object.fromEntries(scenarioNames.map((name) => [name, reviews.some((review) => review.scenario_tests[name])]))
  const latestThreeReviews = [...reviews].sort((a, b) => a.date.localeCompare(b.date)).slice(-3)

  const criteria = {
    complete_daily_runs: {
      passed: consecutiveRuns >= 14 && latestRunCurrent,
      consecutive_complete_days: consecutiveRuns,
      scheduled_runs: runSummaries.length,
      incomplete_runs: runSummaries.filter((run) => !run.complete).map((run) => run.run_id),
      latest_scheduled_at: latestScheduledAt,
      latest_run_age_hours: latestRunAgeHours,
      latest_run_current: latestRunCurrent,
    },
    pilot_claim_traceability: {
      passed: pilots.length > 0 && traceablePilotIds.size === pilots.length,
      traceable_projects: traceablePilotIds.size,
      pilot_projects: pilots.length,
    },
    claim_audit: {
      passed: claimsAudited >= 20 && claimsReproduced === claimsAudited,
      claims_audited: claimsAudited,
      claims_reproduced: claimsReproduced,
    },
    failure_scenarios: {
      passed: Object.values(scenarios).every(Boolean),
      scenarios,
    },
    source_terms: {
      passed: sources.filter((source) => source.operational_state === "approved_automated").every((source) => Boolean(source.terms_url)),
      approved_sources: approvedSourceIds.length,
    },
    critical_accuracy: {
      passed: reviews.reduce((sum, review) => sum + review.critical_errors_published, 0) === 0,
      critical_errors_published: reviews.reduce((sum, review) => sum + review.critical_errors_published, 0),
    },
    review_time: {
      passed: latestThreeReviews.length === 3 && latestThreeReviews.every((review) => review.review_minutes <= 30),
      latest_three_minutes: latestThreeReviews.map((review) => review.review_minutes),
    },
  }

  return {
    generated_at: generatedAt,
    gate_passed: Object.values(criteria).every((criterion) => criterion.passed),
    approved_source_ids: approvedSourceIds,
    excluded_scheduled_run_ids: excludedScheduledRunIds,
    run_summaries: runSummaries,
    criteria,
  }
}

async function readJson(rootUrl, path) {
  return JSON.parse(await readFile(new URL(path, rootUrl), "utf8"))
}

async function readReceipts(rootUrl) {
  const receipts = await readJson(rootUrl, "data/credibility/seed-receipts.json")
  const directory = new URL("data/credibility/receipts/", rootUrl)
  let files = []
  try {
    files = (await readdir(directory)).filter((file) => file.endsWith(".jsonl")).sort()
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
  for (const file of files) {
    const content = await readFile(new URL(file, directory), "utf8")
    for (const line of content.split(/\r?\n/)) {
      if (line.trim()) receipts.push(JSON.parse(line))
    }
  }
  return receipts
}

export async function buildProofStatusFromFiles({ rootUrl = defaultRoot, generatedAt = new Date().toISOString() } = {}) {
  const [sources, receipts, evidence, pilots, reviews] = await Promise.all([
    readJson(rootUrl, "data/credibility/sources.json"),
    readReceipts(rootUrl),
    readJson(rootUrl, "data/credibility/evidence-events.json"),
    readJson(rootUrl, "data/credibility/pilot-projects.json"),
    readJson(rootUrl, "data/credibility/proof-reviews.json"),
  ])
  return buildProofStatus({ sources, receipts, evidence, pilots, reviews, generatedAt })
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  console.log(JSON.stringify(await buildProofStatusFromFiles(), null, 2))
}
