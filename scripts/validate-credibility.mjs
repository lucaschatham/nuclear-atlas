import { readFile, readdir } from "node:fs/promises"
import process from "node:process"

import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"

import { assertAllowedSourceUrl, detectEvidenceConflicts } from "./credibility/core.mjs"

const defaultRoot = new URL("../", import.meta.url)

async function readJson(rootUrl, path) {
  return JSON.parse(await readFile(new URL(path, rootUrl), "utf8"))
}

async function readReceiptLedger(rootUrl) {
  const seed = await readJson(rootUrl, "data/credibility/seed-receipts.json")
  const directory = new URL("data/credibility/receipts/", rootUrl)
  let files = []
  try {
    files = (await readdir(directory)).filter((file) => file.endsWith(".jsonl")).sort()
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }

  const receipts = [...seed]
  for (const file of files) {
    const content = await readFile(new URL(file, directory), "utf8")
    for (const [index, line] of content.split(/\r?\n/).entries()) {
      if (!line.trim()) continue
      try {
        receipts.push(JSON.parse(line))
      } catch {
        throw new Error(`Invalid JSON in data/credibility/receipts/${file}:${index + 1}`)
      }
    }
  }
  return receipts
}

function schemaErrors(label, validate) {
  return (validate.errors ?? []).map((error) => `${label}${error.instancePath || "/"} ${error.message}`)
}

export function evidenceReceiptReferenceErrors({ evidence, receipts }) {
  const receiptById = new Map(receipts.map((receipt) => [receipt.id, receipt]))
  const errors = []
  for (const event of evidence) {
    if (!event.retrieval_receipt_id) continue
    const receipt = receiptById.get(event.retrieval_receipt_id)
    if (!receipt) {
      errors.push(`evidence/${event.id} unknown receipt: ${event.retrieval_receipt_id}`)
    } else if (receipt.source_id !== event.source_id) {
      errors.push(`evidence/${event.id} receipt ${receipt.id} belongs to ${receipt.source_id}, not ${event.source_id}`)
    } else if (!["changed", "unchanged"].includes(receipt.status) || !receipt.sha256) {
      errors.push(`evidence/${event.id} receipt ${receipt.id} is not a successful content-bearing retrieval`)
    }
  }
  return errors
}

export async function validateCredibilityData({ rootUrl = defaultRoot } = {}) {
  const [
    sourceSchema,
    receiptSchema,
    evidenceSchema,
    proofReviewSchema,
    sourceProbeSchema,
    sourceStatusSchema,
    sources,
    evidence,
    pilots,
    deals,
    receipts,
    proofReviews,
    sourceProbes,
    sourceStatuses,
  ] = await Promise.all([
    readJson(rootUrl, "data/credibility/source-definition.schema.json"),
    readJson(rootUrl, "data/credibility/retrieval-receipt.schema.json"),
    readJson(rootUrl, "data/credibility/evidence-event.schema.json"),
    readJson(rootUrl, "data/credibility/proof-review.schema.json"),
    readJson(rootUrl, "data/credibility/source-probe.schema.json"),
    readJson(rootUrl, "data/credibility/source-status.schema.json"),
    readJson(rootUrl, "data/credibility/sources.json"),
    readJson(rootUrl, "data/credibility/evidence-events.json"),
    readJson(rootUrl, "data/credibility/pilot-projects.json"),
    readJson(rootUrl, "data/deals.json"),
    readReceiptLedger(rootUrl),
    readJson(rootUrl, "data/credibility/proof-reviews.json"),
    readJson(rootUrl, "data/credibility/source-probes.json"),
    readJson(rootUrl, "data/credibility/source-status.json"),
  ])

  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addFormats(ajv)
  const validations = [
    ["sources", ajv.compile(sourceSchema), sources],
    ["receipts", ajv.compile(receiptSchema), receipts],
    ["evidence", ajv.compile(evidenceSchema), evidence],
    ["proof reviews", ajv.compile(proofReviewSchema), proofReviews],
    ["source probes", ajv.compile(sourceProbeSchema), sourceProbes],
    ["source statuses", ajv.compile(sourceStatusSchema), sourceStatuses],
  ]
  const errors = []

  for (const [label, validate, records] of validations) {
    if (!validate(records)) errors.push(...schemaErrors(label, validate))
  }

  const sourceById = new Map()
  for (const source of sources) {
    if (sourceById.has(source.id)) errors.push(`sources duplicate id: ${source.id}`)
    sourceById.set(source.id, source)
    try {
      assertAllowedSourceUrl(source.endpoint, source.allowed_hosts)
    } catch (error) {
      errors.push(`sources/${source.id} ${error.message}`)
    }
    if (source.operational_state === "approved_automated" && !source.adapter) {
      errors.push(`sources/${source.id} approved automation requires an adapter`)
    }
    if (source.operational_state === "approved_automated" && !source.comparison_mode) {
      errors.push(`sources/${source.id} approved automation requires a comparison mode`)
    }
    if (source.operational_state === "approved_automated" && !source.accepted_content_types?.length) {
      errors.push(`sources/${source.id} approved automation requires accepted content types`)
    }
    if (["html", "pdf", "portal"].includes(source.access_method) && source.operational_state === "approved_automated") {
      errors.push(`sources/${source.id} review-required access cannot be approved_automated`)
    }
  }

  const receiptIds = new Set()
  for (const receipt of receipts) {
    if (receiptIds.has(receipt.id)) errors.push(`receipts duplicate id: ${receipt.id}`)
    receiptIds.add(receipt.id)
    if (!sourceById.has(receipt.source_id)) errors.push(`receipts/${receipt.id} unknown source: ${receipt.source_id}`)
    if (/api[_-]?key=(?!REDACTED)|token=(?!REDACTED)/i.test(receipt.request_url)) {
      errors.push(`receipts/${receipt.id} contains an unredacted credential`)
    }
  }

  for (const status of sourceStatuses) {
    if (!sourceById.has(status.source_id)) errors.push(`source statuses unknown source: ${status.source_id}`)
    if (!receiptIds.has(status.last_receipt_id)) errors.push(`source statuses/${status.source_id} unknown receipt: ${status.last_receipt_id}`)
  }

  const probedSourceIds = new Set()
  for (const probe of sourceProbes) {
    if (!sourceById.has(probe.source_id)) errors.push(`source probes unknown source: ${probe.source_id}`)
    if (probedSourceIds.has(probe.source_id)) errors.push(`source probes duplicate source: ${probe.source_id}`)
    probedSourceIds.add(probe.source_id)
  }

  const dealIds = new Set(deals.map((deal) => deal.id))
  const eventIds = new Set()
  const eventById = new Map()
  for (const event of evidence) {
    if (eventIds.has(event.id)) errors.push(`evidence duplicate id: ${event.id}`)
    eventIds.add(event.id)
    if (!dealIds.has(event.project_id)) errors.push(`evidence/${event.id} unknown project: ${event.project_id}`)
    const source = sourceById.get(event.source_id)
    if (!source) errors.push(`evidence/${event.id} unknown source: ${event.source_id}`)
    if (source && source.authority_class !== event.authority_class) {
      errors.push(`evidence/${event.id} authority class does not match ${event.source_id}`)
    }
    if (event.claim_key && !event.claim_key.startsWith(`${event.claim_type}.`)) {
      errors.push(`evidence/${event.id} claim key must begin with ${event.claim_type}.`)
    }
    if (event.supersedes_event_id) {
      const referenced = eventById.get(event.supersedes_event_id)
      if (!referenced) {
        errors.push(`evidence/${event.id} supersedes an event that must appear earlier in the ledger`)
      } else if (referenced.project_id !== event.project_id
        || referenced.claim_type !== event.claim_type
        || referenced.claim_key !== event.claim_key) {
        errors.push(`evidence/${event.id} supersession must preserve project, claim type, and claim key`)
      }
    }
    eventById.set(event.id, event)
  }
  errors.push(...evidenceReceiptReferenceErrors({ evidence, receipts }))

  const pilotIds = new Set()
  for (const pilot of pilots) {
    if (pilotIds.has(pilot.project_id)) errors.push(`pilots duplicate project: ${pilot.project_id}`)
    pilotIds.add(pilot.project_id)
    if (!dealIds.has(pilot.project_id)) errors.push(`pilots unknown project: ${pilot.project_id}`)
  }

  for (const review of proofReviews) {
    const auditedEventIds = new Set(review.audited_event_ids)
    const reproducedEventIds = new Set(review.reproduced_event_ids)
    if (review.claims_reproduced > review.claims_audited) {
      errors.push(`proof reviews/${review.date} reproduced claims exceed audited claims`)
    }
    if (review.claims_audited !== auditedEventIds.size) {
      errors.push(`proof reviews/${review.date} claims_audited must equal its distinct audited_event_ids`)
    }
    if (review.claims_reproduced !== reproducedEventIds.size) {
      errors.push(`proof reviews/${review.date} claims_reproduced must equal its distinct reproduced_event_ids`)
    }
    for (const eventId of auditedEventIds) {
      if (!eventIds.has(eventId)) errors.push(`proof reviews/${review.date} unknown audited event: ${eventId}`)
    }
    for (const eventId of reproducedEventIds) {
      if (!eventIds.has(eventId)) errors.push(`proof reviews/${review.date} unknown reproduced event: ${eventId}`)
      if (!auditedEventIds.has(eventId)) errors.push(`proof reviews/${review.date} reproduced event was not audited: ${eventId}`)
    }
    for (const receiptId of review.reviewed_receipt_ids) {
      if (!receiptIds.has(receiptId)) errors.push(`proof reviews/${review.date} unknown receipt: ${receiptId}`)
    }
    for (const eventId of review.reviewed_event_ids) {
      if (!eventIds.has(eventId)) errors.push(`proof reviews/${review.date} unknown evidence event: ${eventId}`)
    }
  }

  const conflicts = detectEvidenceConflicts(evidence, receipts)
  for (const conflict of conflicts) {
    errors.push(`evidence conflict: ${conflict.project_id}/${conflict.claim_key} (${conflict.event_ids.join(", ")})`)
  }

  return {
    errors,
    sourceCount: sources.length,
    receiptCount: receipts.length,
    evidenceCount: evidence.length,
    pilotCount: pilots.length,
    proofReviewCount: proofReviews.length,
    sourceProbeCount: sourceProbes.length,
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const result = await validateCredibilityData()
  if (result.errors.length) {
    console.error(result.errors.join("\n"))
    process.exitCode = 1
  } else {
    console.log(`Validated ${result.sourceCount} sources, ${result.sourceProbeCount} source probes, ${result.receiptCount} receipts, ${result.evidenceCount} evidence events, ${result.pilotCount} pilot projects, and ${result.proofReviewCount} proof reviews.`)
  }
}
