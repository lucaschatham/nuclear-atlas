import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Next's asset bundling does not preserve the worker's relative shared import.
// Copy the installed pair together before dev/build, keeping versions in sync.
const packageRoot = dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json"));
const destination = fileURLToPath(new URL("../public/maplibre/", import.meta.url));
mkdirSync(destination, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(packageRoot, "dist", file), join(destination, file));
}
copyFileSync(join(packageRoot, "LICENSE.txt"), join(destination, "LICENSE.txt"));
