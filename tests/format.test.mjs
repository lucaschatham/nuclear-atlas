import assert from "node:assert/strict"
import test from "node:test"

import { formatFreshnessDate } from "../src/lib/format.ts"

test("freshness dates preserve the source calendar day", () => {
  assert.equal(formatFreshnessDate("2026-08-03"), "Aug 3, 2026")
  assert.equal(formatFreshnessDate("2026-08-03T23:30:00Z"), "Aug 3, 2026")
})
