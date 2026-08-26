import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildWorkflowMermaid } from "../src/lib/methodology-diagram.ts";
import {
  methodologySources,
  methodologyStages,
  methodology,
  filterMethodologySources,
} from "../src/lib/methodology.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("rendered diagrams and the PRD cannot silently drift from source", async () => {
  const manifest = JSON.parse(
    await read("public/methodology/diagram-manifest.json"),
  );
  const css = await read("src/app/globals.css");
  const tokens = css.match(/:root\s*\{([^}]+)\}/)?.[1];
  assert.equal(
    manifest.themeHash,
    createHash("sha256").update(tokens).digest("hex"),
    "Theme changed: run npm run generate:methodology",
  );
  assert.deepEqual(Object.keys(manifest.diagrams), ["workflow"]);
  for (const name of ["workflow"]) {
    assert.equal(
      manifest.diagrams[name],
      createHash("sha256")
        .update(await read(`public/methodology/${name}.mmd`))
        .digest("hex"),
      "Diagram changed: run npm run generate:methodology",
    );
  }
  const prd = await read("public/methodology/nuclear-atlas-prd.md");
  assert.equal((prd.match(/```mermaid/g) ?? []).length, 1);
  for (const source of methodologySources) {
    assert.ok(prd.includes(source.name));
    assert.ok(source.examples.every((example) => prd.includes(example)));
  }
  const diagram = await read("public/methodology/workflow.mmd");
  assert.equal(
    diagram,
    buildWorkflowMermaid(methodologySources, methodology.workflow),
  );
  for (const source of methodologySources) {
    assert.ok(
      diagram.includes(source.id),
      `Missing diagram source: ${source.id}`,
    );
  }
  for (const decision of methodology.decisions)
    assert.ok(prd.includes(decision.question));
  const examples = JSON.parse(
    await read("data/credibility/source-examples.json"),
  );
  assert.deepEqual(
    Object.keys(examples).sort(),
    methodologySources.map((source) => source.id).sort(),
  );
});

test("one connected graph includes every source and marks nonautomated connections", () => {
  const graph = buildWorkflowMermaid(methodologySources, methodology.workflow);
  methodologySources.forEach((source, index) => {
    assert.ok(
      graph.includes(
        `source_${index} ${source.state === "approved_automated" ? "-->" : "-.->"} step_0`,
      ),
    );
  });
  const escaped = buildWorkflowMermaid(
    [{ ...methodologySources[0], name: 'Name "quoted" <script>' }],
    methodology.workflow,
  );
  assert.ok(escaped.includes("#quot;quoted#quot; #60;script#62;"));
  assert.ok(!escaped.includes("<script>"));
});

test("methodology outlines every registered source with concrete examples and its real state", async () => {
  const registry = JSON.parse(await read("data/credibility/sources.json"));
  assert.deepEqual(
    methodologySources.map((source) => source.id),
    registry.map((source) => source.id),
  );
  for (const source of methodologySources) {
    const original = registry.find((entry) => entry.id === source.id);
    assert.equal(source.state, original.operational_state);
    assert.ok(source.examples.length >= 2 && source.examples.length <= 3);
    assert.ok(
      source.examples.every(
        (example) => example.length >= 12 && example.length <= 130,
      ),
    );
    assert.equal(source.endpoint, original.endpoint);
    assert.ok(!("auth_env" in source));
  }
});

test("source inventory search includes natural-language examples and composes with collection state", () => {
  assert.ok(
    filterMethodologySources(methodologySources, "spent fuel", "all").some(
      (source) => source.id === "nrc-spent-fuel",
    ),
  );
  const automated = filterMethodologySources(
    methodologySources,
    "",
    "approved_automated",
  );
  assert.ok(automated.length > 0);
  assert.ok(automated.every((source) => source.state === "approved_automated"));
  assert.equal(
    filterMethodologySources(methodologySources, "no-such-source-xyz", "all")
      .length,
    0,
  );
});

test("methodology distinguishes implemented storage from open decisions and lifecycle aspirations", () => {
  assert.ok(methodology.storage.some((item) => item.status === "Current"));
  assert.ok(
    methodology.storage.some((item) => item.status === "Decision needed"),
  );
  assert.equal(methodologyStages.length, 7);
  assert.deepEqual(
    methodologyStages
      .filter((stage) => stage.status === "Published")
      .map((stage) => stage.id),
    ["projects"],
  );
  assert.ok(methodologyStages.every((stage) => stage.questions.length === 3));
  assert.ok(
    methodology.rules.some((rule) => rule.detail.includes("date-only")),
  );
});

test("methodology diagrams ship rendered, offline assets and editable Mermaid sources", async () => {
  for (const name of ["workflow"]) {
    const source = await read(`public/methodology/${name}.mmd`);
    assert.match(source, /flowchart LR/);
    assert.match(source, /human review/i);
    assert.match(source, /Map and Table/);
    assert.match(source, /OPEN DECISION/);
    {
      const svg = await read(`public/methodology/${name}.svg`);
      assert.match(svg, /<svg/);
      assert.match(svg, /viewBox=/);
      assert.doesNotMatch(
        svg,
        /<script|<foreignObject|https?:\/\/[^\s"]+\.(?:js|css)/i,
      );
    }
  }
});

test("methodology downloads honor the configured production base path", async () => {
  for (const path of [
    "src/app/about/page.tsx",
    "src/features/methodology/workflow-diagram.tsx",
  ]) {
    const source = await read(path);
    assert.match(source, /NEXT_PUBLIC_BASE_PATH/);
    assert.doesNotMatch(source, /href="\/(?:data|methodology)\//);
  }
});
