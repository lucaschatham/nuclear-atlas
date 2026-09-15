import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {fileURLToPath} from 'node:url'
import {readWorkbookTables} from '../scripts/import-atlas-workbook.mjs'
import {createAtlasRecords} from '../src/lib/atlas-workspace.ts'

const keys=['long_mott','clinch_river','kemmerer_1','darlington_1','hermes']
const ids=keys.map(k=>`license_${k}_construction`)
const release=JSON.parse(await readFile(new URL('../data/atlas-release.json',import.meta.url),'utf8'))
const tables=await readWorkbookTables(fileURLToPath(new URL('../data/releases/atlas-release.xlsx',import.meta.url)))
const rows=tables.LICENSE_BUILD.filter(r=>ids.includes(r.license_action_id))
const records=release.stages['build-license'].records.filter(r=>ids.includes(r.id))

test('five distinct licensing actions are visible without unrelated project links',()=>{
 assert.equal(rows.length,5);assert.equal(records.length,5)
 assert.equal(new Set(rows.map(r=>r.license_action_id)).size,5)
 for(const r of rows){assert.equal(r.project_id,'');assert.equal(r.reactor_id,'')}
 const visible=createAtlasRecords(release)
 for(const id of ids) assert.equal(visible.filter(r=>r.id===id).length,1)
 assert.match(records.find(r=>r.id===ids[4]).summary,/non-electric/)
})
test('applications, construction decisions, and unknown dates remain distinct',()=>{
 const byId=Object.fromEntries(rows.map(r=>[r.license_action_id,r]))
 for(const id of ids.slice(0,2)){
  assert.equal(byId[id]?.normalized_status,'under_review')
  assert.equal(byId[id]?.decision_date,'');assert.equal(byId[id]?.effective_date,'')
 }
 assert.equal(byId[ids[0]]?.application_date,'2025-03-31')
 assert.equal(byId[ids[1]]?.application_date,'')
 assert.equal(byId[ids[2]]?.decision_date,'2026-03-09')
 assert.equal(byId[ids[3]]?.decision_date,'2025-04-04')
 assert.equal(byId[ids[4]]?.decision_date,'2023-12-14')
 assert.match(byId[ids[3]]?.source_status_text??'',/one BWRX-300/)
 assert.equal(byId[ids[4]]?.application_date,'') // Application submitted in two parts; no single inferred date.
 for(const r of records) assert.notEqual(r.status,'operating')
})
test('new factual fields have field-specific citations and honest geography',()=>{
 assert.equal(rows.length,5)
 for(const row of rows){
  const citations=tables.CITATIONS.filter(c=>c.record_table==='LICENSE_BUILD'&&c.record_id===row.license_action_id)
  const supported=new Set(citations.flatMap(c=>c.supports_fields.split(',').map(x=>x.trim())))
  for(const [field,value] of Object.entries(row)){
   if(value===''||['license_action_id','review_status'].includes(field))continue
   assert.ok(supported.has(field),`${row.license_action_id}: uncited ${field}`)
  }
  assert.notEqual(row.location_precision,'site')
  assert.match(row.coordinate_note,/not.*site/i)
  for(const c of citations){assert.ok(c.locator);assert.ok(c.retrieved_at_utc);assert.equal(c.review_status,'approved')}
 }
})
test('baseline records and dates survive the targeted update unchanged',()=>{
 const previous=Object.values(release.stages).flatMap(s=>s.records).filter(r=>!ids.includes(r.id))
 assert.equal(previous.length,247)
 assert.equal(createHash('sha256').update(JSON.stringify(previous)).digest('hex'),'653079e02d1470f9c28ed41cf719dfce6afbb3c55fbd395d60516a77c47217f0')
 assert.equal(release.sourceCutoffUtc,'2026-08-26T23:50:00Z')
})
