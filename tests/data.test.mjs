import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../", import.meta.url)

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"))
}

test("seed dataset contains at least 15 sourced, unique deals", async () => {
  const deals = await readJson("data/deals.json")
  assert.ok(deals.length >= 15)

  const ids = deals.map((deal) => deal.id)
  assert.equal(new Set(ids).size, ids.length)

  for (const deal of deals) {
    assert.ok(deal.sources.length >= 1, `${deal.id} is missing sources`)
    assert.match(deal.bindingness.evidence, /\S/)
    assert.doesNotMatch(
      deal.analyst_note,
      /firm.*optioned.*(?:combined|total)|(?:combined|total).*firm.*optioned/i,
      `${deal.id} appears to merge firm and optioned capacity`,
    )
  }
})

test("changelog references known deals", async () => {
  const [deals, changelog] = await Promise.all([
    readJson("data/deals.json"),
    readJson("data/changelog.json"),
  ])
  const ids = new Set(deals.map((deal) => deal.id))

  for (const entry of changelog) {
    assert.ok(ids.has(entry.deal), `Unknown changelog deal: ${entry.deal}`)
    assert.match(entry.source, /^https:\/\//)
  }
})

test("product branding and repository links use Nuclear Notebook", async () => {
  const files = await Promise.all([
    "README.md",
    "CONTRIBUTING.md",
    "next.config.ts",
    "package.json",
    "src/app/layout.tsx",
    "src/app/about/page.tsx",
    "src/components/site-header.tsx",
  ].map((path) => readFile(new URL(path, root), "utf8")))

  const content = files.join("\n")
  assert.match(content, /Nuclear Notebook/)
  assert.match(content, /lucaschatham\/nuclear-notebook/)
  assert.doesNotMatch(content, /Nuclear Data Center Deal Tracker/)
  assert.doesNotMatch(content, /nuclear-datacenter-deal-tracker/)
})

test("every registered source has a concise plain-language guide", async () => {
  const [sources, guide] = await Promise.all([
    readJson("data/credibility/sources.json"),
    readJson("data/credibility/source-guide.json"),
  ])
  const sourceIds = sources.map((source) => source.id).sort()
  const guideIds = guide.map((entry) => entry.source_id).sort()

  assert.deepEqual(guideIds, sourceIds)
  assert.equal(new Set(guideIds).size, guideIds.length)

  for (const entry of guide) {
    assert.match(entry.category, /\S/)
    assert.match(entry.plain_english, /\S/)
    assert.ok(
      entry.plain_english.length <= 180,
      `${entry.source_id} explanation is too long`,
    )
  }
})
