import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = join(root, "src");
const violations = [];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

for (const file of await filesUnder(sourceRoot)) {
  if (!new Set([".ts", ".tsx"]).has(extname(file))) continue;
  const name = relative(root, file);
  const content = await readFile(file, "utf8");

  if (!name.startsWith("src/components/ui/")) {
    const rawControl = content.match(/<(button|input|select|textarea|table|dialog)(?:\s|>)/);
    if (rawControl) violations.push(`${name}: raw <${rawControl[1]}>. Use a shadcn primitive.`);
  }

  const hardcodedColor = content.match(/(?:#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i);
  if (hardcodedColor) violations.push(`${name}: hardcoded color ${hardcodedColor[0]}. Use a semantic token.`);
}

const removedV1 = [
  "src/components/nuclear-atlas.tsx",
  "src/components/atlas-map.tsx",
  "src/components/deal-explorer.tsx",
  "src/components/source-dashboard.tsx",
];
const allFiles = new Set((await filesUnder(sourceRoot)).map((file) => relative(root, file)));
for (const path of removedV1) if (allFiles.has(path)) violations.push(`${path}: retired V1 presentation file still exists.`);

if (violations.length) {
  console.error(`UI validation failed:\n${violations.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

console.log("UI validation passed: shadcn controls, semantic colors, and one V2 presentation stack.");
