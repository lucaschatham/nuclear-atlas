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
