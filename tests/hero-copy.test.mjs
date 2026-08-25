import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const component = await readFile(new URL("../src/features/atlas/atlas-workspace.tsx", import.meta.url), "utf8")

test("the compact hero leads with the Nuclear Atlas mission", () => {
  assert.match(component, /<h1[^>]*>Nuclear Atlas<\/h1>/)
  assert.match(component, /Understand the global nuclear landscape, from fuel supply and new projects to spent fuel and decommissioning\./)
  assert.match(component, /Built from public evidence\. Every record shows its source, date, and location precision\. Coverage gaps remain visible\./)
  assert.doesNotMatch(component, /Global public evidence atlas/)
})
