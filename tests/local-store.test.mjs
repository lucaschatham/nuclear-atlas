import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"

test("local SQLite store preserves evidence, history, and recoverable backups", () => {
  const result = spawnSync("python3", ["-B", "-m", "unittest", "discover", "-s", "tests/local-store", "-v"], {
    cwd: new URL("../", import.meta.url), encoding: "utf8",
  })
  assert.equal(result.status, 0, result.error?.message ?? `${result.stdout}\n${result.stderr}`)
})
