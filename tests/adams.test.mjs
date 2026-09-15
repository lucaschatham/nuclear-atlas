import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { collectAdams } from '../scripts/collect-adams.mjs'

const document = { AccessionNumber: 'ML26100A001', DocumentTitle: 'Pilot document', DocketNumber: ['05000220'], DocumentDate: null }
async function run(t, payload, extra = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-adams-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const raw = JSON.stringify(payload)
  const result = await collectAdams({ directory, key: 'test-private-key', now: new Date('2026-09-15T12:00:00Z'), fetchImpl: async (_, init) => {
    assert.equal(init.headers['Ocp-Apim-Subscription-Key'], 'test-private-key')
    const query = JSON.parse(init.body)
    assert.equal(query.filters[0].value, '05000220')
    assert.match(query.filters[1].value, /DateAddedTimestamp ge '2026-06-17'/)
    assert.equal(init.redirect, 'error')
    return new Response(raw, { headers: { 'content-type': 'application/json' } })
  }, ...extra })
  return { directory, result, raw }
}
test('archives exact response and imports metadata with provenance into SQLite', async t => {
  const {directory, result, raw} = await run(t, { results: [{document}], count: 100 })
  assert.equal(result.outcome, 'collected_partial')
  assert.equal(await readFile(join(result.runDirectory, 'response.json'), 'utf8'), raw)
  const q = spawnSync('python3', ['-c', 'import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); print(c.execute("select record_id,payload_json from records").fetchone())', join(directory, 'nuclear-atlas.sqlite')], { encoding:'utf8' })
  assert.equal(q.status, 0)
  assert.match(q.stdout, /ML26100A001/)
  assert.match(q.stdout, /"DocumentDate": null/)
  assert.doesNotMatch(await readFile(join(result.runDirectory, 'manifest.json'), 'utf8'), /test-private-key/)
})
test('missing key fails before network access', async () => {
  await assert.rejects(collectAdams({ key: '', fetchImpl: () => assert.fail('network called') }), /NRC_ADAMS_SUBSCRIPTION_KEY/)
})
test('duplicate accessions collapse only when metadata agrees', async t => {
  const {result} = await run(t, {results: [{document}, {document}]})
  assert.equal(result.recordCount, 1)
  await assert.rejects(run(t, {results: [{document}, {document: {...document, DocumentTitle:'changed'}}]}), /conflicting/)
})
test('empty results produce receipt without an empty SQLite collection', async t => {
  const {directory, result} = await run(t, {results: []})
  assert.equal(result.outcome, 'empty_partial')
  assert.ok(!(await readdir(directory)).includes('nuclear-atlas.sqlite'))
})
test('malformed metadata fails without a collection', async t => {
  await assert.rejects(run(t, {results: [{document:{DocumentTitle:'no accession'}}]}), /accession/)
  await assert.rejects(run(t, {unexpected: []}), /results/)
})
test('authentication and upstream failures expose status, not response body', async t => {
  for (const status of [401,403,429,500]) {
    await assert.rejects(run(t, {}, {fetchImpl: async () => new Response('test-private-key', {status})}), new RegExp(`HTTP ${status}`))
  }
})
test('network errors and reflected credentials cannot leak into archives', async t => {
  await assert.rejects(run(t, {}, {fetchImpl: async () => {throw new Error('test-private-key')}}), /request failed/)
  await assert.rejects(run(t, {results:[{document:{...document, note:'test-private-key'}}]}), /credential/)
})
