import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import process from "node:process"

import { runSourceCheck } from "./pipeline.mjs"

const root = new URL("../../", import.meta.url)
const dataDirectory = new URL("data/credibility/", root)
const receiptDirectory = new URL("receipts/", dataDirectory)
const candidateDirectory = new URL("candidates/", dataDirectory)
const artifactDirectory = new URL(".credibility-artifacts/", root)

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"))
}

async function readReceiptLedger() {
  const receipts = await readJson(new URL("seed-receipts.json", dataDirectory))
  let files = []
  try {
    files = (await readdir(receiptDirectory)).filter((file) => file.endsWith(".jsonl")).sort()
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
  for (const file of files) {
    const content = await readFile(new URL(file, receiptDirectory), "utf8")
    for (const line of content.split(/\r?\n/)) {
      if (line.trim()) receipts.push(JSON.parse(line))
    }
  }
  return receipts
}

function latestSuccessfulReceipt(receipts, sourceId) {
  return receipts
    .filter((receipt) => receipt.source_id === sourceId && ["changed", "unchanged"].includes(receipt.status))
    .sort((a, b) => b.checked_at.localeCompare(a.checked_at))[0] ?? null
}

function parseArguments(argv) {
  const sourceIds = []
  let dryRun = false
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--dry-run") dryRun = true
    if (argv[index] === "--source") {
      const sourceId = argv[index + 1]
      if (!sourceId) throw new Error("--source requires a source id")
      sourceIds.push(sourceId)
      index += 1
    }
  }
  return { sourceIds, dryRun }
}

async function persistResult(result) {
  const date = result.receipt.checked_at.slice(0, 10)

  if (result.candidate && result.receipt.status === "changed") {
    const sourceCandidateDirectory = new URL(`${result.receipt.source_id}/`, candidateDirectory)
    await mkdir(sourceCandidateDirectory, { recursive: true })
    result.receipt.archive_path = `data/credibility/candidates/${result.receipt.source_id}/${result.receipt.id}.json`
    await writeFile(new URL(`${result.receipt.id}.json`, sourceCandidateDirectory), `${JSON.stringify(result.candidate, null, 2)}\n`)
  }

  if (result.rawBody && result.receipt.status === "changed") {
    const datedArtifacts = new URL(`${date}/`, artifactDirectory)
    await mkdir(datedArtifacts, { recursive: true })
    await writeFile(new URL(`${result.receipt.id}.raw`, datedArtifacts), result.rawBody)
  }

  await mkdir(receiptDirectory, { recursive: true })
  await appendFile(new URL(`${date}.jsonl`, receiptDirectory), `${JSON.stringify(result.receipt)}\n`)
}

export async function runCredibilityPipeline({ argv = process.argv.slice(2), checkedAt = new Date().toISOString() } = {}) {
  const { sourceIds, dryRun } = parseArguments(argv)
  const runId = buildRunId({ checkedAt })
  const runMode = process.env.CREDIBILITY_RUN_MODE
    ?? (sourceIds.length || dryRun || !process.env.GITHUB_ACTIONS ? "manual_probe" : "scheduled")
  const [sources, receipts, existingStatuses] = await Promise.all([
    readJson(new URL("sources.json", dataDirectory)),
    readReceiptLedger(),
    readJson(new URL("source-status.json", dataDirectory)),
  ])
  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const selected = sourceIds.length
    ? sourceIds.map((id) => {
        const source = sourceById.get(id)
        if (!source) throw new Error(`Unknown source id: ${id}`)
        return source
      })
    : sources.filter((source) => source.operational_state === "approved_automated")

  const statusById = new Map(existingStatuses.map((status) => [status.source_id, status]))
  const results = []
  for (const source of selected) {
    const previousReceipt = latestSuccessfulReceipt(receipts, source.id)
    const result = await runSourceCheck({
      source,
      runId,
      runMode,
      checkedAt,
      previousReceipt,
      previousStatus: statusById.get(source.id) ?? null,
      captureFailure: true,
    })
    results.push(result)
    statusById.set(source.id, result.status)
    if (!dryRun) await persistResult(result)
    const suffix = result.error ? ` (${result.error.name}: ${result.error.message})` : ""
    console.log(`${source.id}: ${result.receipt.status}${suffix}`)
  }

  if (!dryRun) {
    const statuses = [...statusById.values()].sort((a, b) => a.source_id.localeCompare(b.source_id))
    await writeFile(new URL("source-status.json", dataDirectory), `${JSON.stringify(statuses, null, 2)}\n`)
  }

  return { results, dryRun }
}

export function buildRunId({ checkedAt, env = process.env }) {
  if (env.GITHUB_RUN_ID) return `github-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT ?? "1"}`
  return `local-${checkedAt.replace(/[^0-9]/g, "").slice(0, 17)}`
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const run = await runCredibilityPipeline()
  if (run.results.some((result) => result.error)) process.exitCode = 1
}
