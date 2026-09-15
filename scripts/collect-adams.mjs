import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { assertAllowedSourceUrl } from './credibility/core.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const endpoint = 'https://adams-api.nrc.gov/aps/api/search'
const pilot = { docket: '05000220', recordId: 'ops_nrc_05000220_2025q1', name: 'Nine Mile Point 1' }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

// One response only. Neither NRC count nor HTTP success establishes completeness.
export async function collectAdams({ directory = join(root, '.local-data'), key = process.env.NRC_ADAMS_SUBSCRIPTION_KEY, now = new Date(), fetchImpl = globalThis.fetch } = {}) {
  if (!key?.trim()) throw new Error('Set NRC_ADAMS_SUBSCRIPTION_KEY in the environment or gitignored .env.local. No request was made.')
  key = key.trim()
  const release = JSON.parse(await readFile(join(root, 'data/atlas-release.json'), 'utf8'))
  const record = release.stages.operations.records.find(item => item.id === pilot.recordId)
  if (!record?.citations.some(c => c.locator?.includes(`Docket ${pilot.docket}`))) throw new Error('Pilot docket is no longer supported by the Atlas release.')
  const until = now.toISOString().slice(0, 10)
  const since = new Date(now.valueOf() - 90 * 86400000).toISOString().slice(0, 10)
  const query = { q: '', filters: [
    {field:'DocketNumber', value:pilot.docket, operator:'equals'},
    {field:'DateAddedTimestamp', value:`(DateAddedTimestamp ge '${since}') and (DateAddedTimestamp le '${until}')`},
  ], anyFilters:[], mainLibFilter:true, legacyLibFilter:false, sort:'DateAddedTimestamp', sortDirection:1, skip:0 }
  assertAllowedSourceUrl(endpoint, ['adams-api.nrc.gov'])
  const runsDirectory = join(resolve(directory), 'adams-runs')
  await mkdir(runsDirectory, {recursive:true, mode:0o700})
  const runDirectory = await mkdtemp(join(runsDirectory, 'pilot-'))
  const manifest = { sourceId:'nrc-adams', endpoint, pilot, releaseId:release.releaseId, query,
    startedAtUtc:now.toISOString(), retrievedAtUtc:null, completeness:'partial',
    scope:'One search response for one verified docket; no pagination or complete-history claim. Date filter values retained as sent; source timezone not inferred.',
    outcome:'started', recordCount:0 }
  const save = () => writeFile(join(runDirectory,'manifest.json'), JSON.stringify(manifest,null,2)+'\n', {mode:0o600})
  await save()
  try {
    let response, bytes
    try {
      response = await fetchImpl(endpoint, {method:'POST', redirect:'error', signal:AbortSignal.timeout(30000),
        headers:{'Content-Type':'application/json', Accept:'application/json', 'Ocp-Apim-Subscription-Key':key}, body:JSON.stringify(query)})
      manifest.httpStatus = response.status
      if (!response.ok) { await response.body?.cancel(); throw new Error(`ADAMS HTTP ${response.status}. No data imported.`) }
      if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('ADAMS returned a non-JSON response.')
      const chunks = []; let size = 0
      if (!response.body) throw new Error('ADAMS returned no response body.')
      const reader = response.body.getReader()
      try {
        while (true) {
          const {done,value} = await reader.read(); if(done) break
          size += value.byteLength
          if (size > 10 * 1024 * 1024) {await reader.cancel(); throw new Error('ADAMS response exceeds the 10 MiB pilot limit.')}
          chunks.push(Buffer.from(value))
        }
      } finally { reader.releaseLock() }
      bytes = Buffer.concat(chunks)
    } catch {
      throw new Error(response && !response.ok ? `ADAMS HTTP ${response.status}. No data imported.` : 'ADAMS request failed or exceeded response limits. No data imported.')
    }
    manifest.retrievedAtUtc = new Date().toISOString()
    const text = bytes.toString('utf8')
    // Never persist a reflected subscription credential, even in raw source data.
    if (text.includes(key) || text.includes(JSON.stringify(key).slice(1,-1))) throw new Error('ADAMS response contains a credential; response discarded.')
    manifest.responseSha256 = hash(bytes)
    await writeFile(join(runDirectory,'response.json'),bytes,{mode:0o600})
    let payload
    try {payload = JSON.parse(text)} catch {throw new Error('ADAMS returned malformed JSON.')}
    if (!Array.isArray(payload.results)) throw new Error('ADAMS response is missing results array.')
    const byAccession = new Map()
    for (const item of payload.results) {
      const doc = item?.document
      if (!doc || typeof doc.AccessionNumber !== 'string' || !doc.AccessionNumber.trim()) throw new Error('ADAMS document is missing an accession number.')
      // Retain source metadata; search-provided content is kept only in the raw response.
      const metadata = Object.fromEntries(Object.entries(doc).filter(([name]) => name.toLowerCase() !== 'content'))
      const old = byAccession.get(doc.AccessionNumber)
      if (old && JSON.stringify(old) !== JSON.stringify(metadata)) throw new Error('ADAMS returned conflicting metadata for one accession.')
      byAccession.set(doc.AccessionNumber, metadata)
    }
    const records = [...byAccession.values()]
    manifest.recordCount = records.length
    manifest.returnedResultCount = payload.results.length
    manifest.reportedCount = typeof payload.count === 'number' ? payload.count : null
    const recordsPath = join(runDirectory,'records.json')
    await writeFile(recordsPath,JSON.stringify(records,null,2)+'\n',{mode:0o600})
    if (records.length) {
      const imported = spawnSync('python3',['-B',join(root,'scripts/local-store.py'),'--directory',resolve(directory),'import-json',recordsPath,
        '--source-id','nrc-adams','--source-url',endpoint,'--id-field','AccessionNumber',
        '--scope',JSON.stringify({pilot,query,rawResponseSha256:manifest.responseSha256,rawResponsePath:join('adams-runs',runDirectory.split('/').pop(),'response.json')}),
        '--retrieved-at',manifest.retrievedAtUtc,'--completeness','partial'],{encoding:'utf8'})
      if (imported.status !== 0) throw new Error('Local SQLite import or backup failed. Inspect the local archive before retrying; no publication occurred.')
    }
    manifest.outcome = records.length ? 'collected_partial' : 'empty_partial'
    await save()
    return {...manifest,runDirectory}
  } catch (error) {
    manifest.outcome = 'failed'
    await save()
    throw error
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const {values} = parseArgs({options:{directory:{type:'string'}},allowPositionals:false})
    try {process.loadEnvFile(join(root,'.env.local'))} catch(error) {if(error.code !== 'ENOENT') throw new Error('Cannot load .env.local.')}
    const result = await collectAdams({directory:values.directory})
    console.log(JSON.stringify({outcome:result.outcome,records:result.recordCount,runDirectory:result.runDirectory,completeness:result.completeness},null,2))
  } catch(error) {console.error(error.message); process.exitCode=1}
}
