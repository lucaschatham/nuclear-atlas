import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("worker preparation ships the installed worker and its relative dependency unchanged", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const packageRoot = dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json"));
  execFileSync(process.execPath, [join(root, "scripts/prepare-maplibre.mjs")]);
  for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
    assert.deepEqual(readFileSync(join(root, "public/maplibre", file)), readFileSync(join(packageRoot, "dist", file)));
  }
  assert.deepEqual(readFileSync(join(root, "public/maplibre/LICENSE.txt")), readFileSync(join(packageRoot, "LICENSE.txt")));
  const scripts = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts;
  for (const hook of ["predev", "prebuild"]) assert.match(scripts[hook], /node scripts\/prepare-maplibre\.mjs/);
});
