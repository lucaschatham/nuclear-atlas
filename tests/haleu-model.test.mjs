import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../public/haleu-model/index.html', import.meta.url), 'utf8');
test('published fuel model excludes private identity and workbook links', () => {
  assert.doesNotMatch(html, /valar|charlotte|mark’s|docs\.google\.com|127\.0\.0\.1|\/Users\//i);
  assert.match(html, /NUCLEAR ATLAS/);
});
test('published standalone model retains workbook arithmetic and capacity guards', () => {
  const context = createContext({});
  runInContext(html.match(/<script id="model">([\s\S]*?)<\/script>/)[1], context);
  const { DEFAULTS, calculate, supplier, buyer } = context.Haleu;
  const state = {...DEFAULTS, cores:1000};
  const m = calculate(state);
  assert.ok(Math.abs(m.swu - 20500.557639) < .001);
  assert.ok(Math.abs(m.feed - 21149.67462) < .001);
  assert.ok(Math.abs(calculate({...state,mode:'staged'}).blended - 312.053460964)<.000001);
  assert.equal(supplier(state,m).stages[3],null);
  assert.equal(supplier(state,m).ceiling,101);
  assert.ok(Math.abs(buyer(state,m).effective-180)<.000001);
  assert.equal(calculate({...state,cores:0}).annualSwu,0);
});
