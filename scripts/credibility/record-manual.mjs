import { appendFile, mkdir, readFile, readdir, stat } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import process from "node:process"

import { assertAllowedSourceUrl, buildReceipt, hashContent } from "./core.mjs"

const defaultRoot = new URL("../../", import.meta.url)
const manualAdapterVersion = "manual-capture@1.0.0"

function validDateTime(value, label) {
  if (value === null) return
  if (!value || Number.isNaN(new Date(value).valueOf())) throw new Error(`${label} must be an ISO date-time.`)
}

export function buildManualReceipt({
  source,
  documentUrl,
  body,
  contentType,
  checkedAt = new Date().toISOString(),
  sourcePublishedAt = null,
  previousReceipt = null,
}) {
  assertAllowedSourceUrl(documentUrl, source.allowed_hosts)
  validDateTime(checkedAt, "checkedAt")
  validDateTime(sourcePublishedAt, "sourcePublishedAt")
  if (!contentType) throw new Error("contentType is required.")
  if (!Buffer.isBuffer(body)) throw new TypeError("body must be a Buffer.")
  if (body.byteLength > source.maximum_response_bytes) {
    throw new Error(`${source.id} exceeds its ${source.maximum_response_bytes}-byte manual capture limit.`)
  }

  const sha256 = hashContent(body)
  const status = previousReceipt?.sha256 === sha256 ? "unchanged" : "changed"
  return buildReceipt({
    source: { ...source, adapter_version: manualAdapterVersion },
    runId: `manual-${checkedAt.replace(/[^0-9]/g, "").slice(0, 17)}`,
    runMode: "manual_probe",
    checkedAt,
    requestUrl: documentUrl,
    status,
    headers: { "content-type": contentType },
    body,
    durationMs: 0,
    sourcePublishedAt,
    previousReceiptId: previousReceipt?.id ?? null,
  })
}

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"))
}

async function readReceiptLedger(rootUrl) {
  const dataDirectory = new URL("data/credibility/", rootUrl)
  const receiptDirectory = new URL("receipts/", dataDirectory)
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

function parseArguments(argv) {
  const options = {}
  const names = new Set(["--source", "--url", "--file", "--content-type", "--published-at"])
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]
    const value = argv[index + 1]
    if (!names.has(name) || !value) throw new Error(`Invalid or incomplete argument: ${name ?? "missing"}`)
    options[name.slice(2).replaceAll("-", "_")] = value
  }
  for (const required of ["source", "url", "file", "content_type"]) {
    if (!options[required]) throw new Error(`--${required.replaceAll("_", "-")} is required.`)
  }
  return options
}

export async function recordManualReceipt({ argv = process.argv.slice(2), rootUrl = defaultRoot, checkedAt = new Date().toISOString() } = {}) {
  const options = parseArguments(argv)
  const dataDirectory = new URL("data/credibility/", rootUrl)
  const receiptDirectory = new URL("receipts/", dataDirectory)
  const [sources, receipts, fileStats] = await Promise.all([
    readJson(new URL("sources.json", dataDirectory)),
    readReceiptLedger(rootUrl),
    stat(options.file),
  ])
  const source = sources.find((candidate) => candidate.id === options.source)
  if (!source) throw new Error(`Unknown source id: ${options.source}`)
  if (!fileStats.isFile()) throw new Error(`Manual evidence path is not a file: ${options.file}`)
  if (fileStats.size > source.maximum_response_bytes) {
    throw new Error(`${source.id} exceeds its ${source.maximum_response_bytes}-byte manual capture limit.`)
  }
  const body = await readFile(options.file)
  const previousReceipt = receipts
    .filter((receipt) => receipt.source_id === source.id && ["changed", "unchanged"].includes(receipt.status))
    .sort((a, b) => b.checked_at.localeCompare(a.checked_at))[0] ?? null
  const receipt = buildManualReceipt({
    source,
    documentUrl: options.url,
    body,
    contentType: options.content_type,
    checkedAt,
    sourcePublishedAt: options.published_at ?? null,
    previousReceipt,
  })
  if (receipts.some((existing) => existing.id === receipt.id)) throw new Error(`Receipt already exists: ${receipt.id}`)

  await mkdir(receiptDirectory, { recursive: true })
  await appendFile(new URL(`${checkedAt.slice(0, 10)}.jsonl`, receiptDirectory), `${JSON.stringify(receipt)}\n`)
  return receipt
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const receipt = await recordManualReceipt()
  console.log(`Recorded ${receipt.id} (${receipt.status}).`)
}
