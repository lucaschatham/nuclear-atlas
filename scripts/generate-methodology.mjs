import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  methodology,
  methodologySources,
  methodologyStages,
} from "../src/lib/methodology.ts";
import { collectionStateLabels } from "../src/lib/methodology-contract.ts";
import { buildWorkflowMermaid } from "../src/lib/methodology-diagram.ts";

const root = new URL("../", import.meta.url);
const output = new URL("public/methodology/", root);
const read = (path) => readFile(new URL(path, root), "utf8");
const diagrams = [
  {
    name: "workflow",
    source: buildWorkflowMermaid(methodologySources, methodology.workflow),
  },
];
await writeFile(new URL("workflow.mmd", output), diagrams[0].source);
const lines = [
  "# Nuclear Atlas: methodology and living PRD",
  "",
  `${methodology.status} | Version ${methodology.version}`,
  "",
  methodology.objective,
  "",
  "This document distinguishes current implementation from planned work. Registered source capabilities are not a claim that all fields are ingested or published.",
  "",
  "## Workflow",
  "",
  ...methodology.workflow.flatMap((step, index) => [
    `${index + 1}. **${step.title}.** ${step.detail} ${step.caveat}`,
    "",
  ]),
  ...diagrams.flatMap(({ source }) => [
    "### One horizontal workflow, on every screen",
    "",
    "```mermaid",
    source.trim(),
    "```",
    "",
  ]),
  "## Storage is an open decision",
  "",
  ...methodology.storage.flatMap((item) => [
    `### ${item.title} (${item.status})`,
    "",
    item.detail,
    "",
    `Location: ${item.location}`,
    "",
  ]),
  "### Decision tests",
  "",
  ...methodology.decisions.flatMap((item) => [
    `- **${item.title}:** ${item.question} ${item.acceptance}`,
    "",
  ]),
  "## Dashboard interaction contract",
  "",
  ...methodology.ui.flatMap((item) => [
    `### ${item.title} (${item.status})`,
    "",
    item.detail,
    "",
  ]),
  "## Lifecycle scope",
  "",
  ...methodologyStages.flatMap((stage) => [
    `### ${stage.label} (${stage.status})`,
    "",
    `For: ${stage.audience}`,
    "",
    ...stage.questions.map((question) => `- ${question}`),
    "",
    `Next: ${stage.next}`,
    "",
  ]),
  "## Evidence rules",
  "",
  ...methodology.rules.flatMap((item) => [
    `### ${item.title}`,
    "",
    item.detail,
    "",
  ]),
  "### Bindingness rubric",
  "",
  ...methodology.rubric.map(
    ([tier, definition]) => `- **${tier}:** ${definition}`,
  ),
  "",
  "## Non-goals",
  "",
  ...methodology.nonGoals.map((item) => `- ${item}`),
  "",
  "## Acceptance criteria",
  "",
  ...methodology.releaseChecks.map((item) => `- [ ] ${item}`),
  "",
  `## All ${methodologySources.length} registered source families`,
  "",
  "Examples describe source capabilities. Automated collection is not approval to publish. Family-level registrations may still need individual datasets and jurisdictions onboarded.",
  "",
  ...methodologySources.flatMap((source) => [
    `### ${source.name}`,
    "",
    `- Source: ${source.endpoint}`,
    `- State: ${collectionStateLabels[source.state]}`,
    `- Category: ${source.category}`,
    `- Geography: ${source.geography.join(", ")}`,
    `- Access: ${source.access}; source cadence: ${source.cadence}`,
    `- Authority: ${source.authority}`,
    `- Last recorded check (UTC): ${source.lastCheckUtc ?? "No published receipt"}`,
    "",
    ...source.examples.map((example) => `- ${example}`),
    "",
    source.notes,
    "",
  ]),
  "## Contributing",
  "",
  "Edit data/methodology.json for workflow steps and product requirements; edit data/credibility/source-examples.json for source examples. Source identities and collection states come from the existing source registry. The single Mermaid graph is generated from those same inputs.",
  "",
  "Run npm run generate:methodology after diagram or theme changes. Run npm run generate:methodology:docs after content changes (also runs before local development and production builds). Changes should be reviewed before publication.",
  "",
  "Code and Atlas-authored data use the MIT License. Upstream records retain their own terms. This tool does not guarantee global completeness, safety, investment returns, or available storage capacity.",
  "",
];
await writeFile(new URL("nuclear-atlas-prd.md", output), lines.join("\n"));
if (!process.argv.includes("--diagrams")) {
  console.log(
    `Generated living PRD with ${methodologySources.length} sources.`,
  );
} else {
  // Rendering is a developer task. No Mermaid runtime is shipped to the site.
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1950, height: 1200 },
    });
    await page.route(/^https?:/, (route) => route.abort());
    const css = await read("src/app/globals.css");
    const tokens = css.match(/:root\s*\{([^}]+)\}/)?.[1];
    if (!tokens) throw new Error("Theme tokens not found.");
    await page.setContent(`<style>:root {${tokens}}</style><body></body>`);
    await page.addScriptTag({
      path: fileURLToPath(
        new URL("node_modules/mermaid/dist/mermaid.min.js", root),
      ),
    });
    const theme = await page.evaluate(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const color = (name) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = rootStyle.getPropertyValue(name).trim();
        context.fillRect(0, 0, 1, 1);
        return (
          "#" +
          [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("")
        );
      };
      return {
        background: color("--card"),
        primary: color("--primary"),
        foreground: color("--foreground"),
        border: color("--border"),
        muted: color("--muted"),
        line: color("--muted-foreground"),
        accent: color("--accent"),
      };
    });
    const manifest = {
      schemaVersion: 1,
      themeHash: createHash("sha256").update(tokens).digest("hex"),
      diagrams: {},
    };
    for (const { name, source } of diagrams) {
      {
        const graph =
          source +
          `\nclassDef action fill:${theme.accent},stroke:${theme.primary},color:${theme.foreground},stroke-width:1.5px;\nclassDef store fill:${theme.background},stroke:${theme.line},color:${theme.foreground};\nclassDef note fill:${theme.muted},stroke:${theme.border},color:${theme.foreground};\n`;
        const svg = await page.evaluate(
          async ({ graph, id, theme }) => {
            window.mermaid.initialize({
              startOnLoad: false,
              securityLevel: "strict",
              theme: "base",
              deterministicIds: true,
              deterministicIDSeed: id,
              htmlLabels: false,
              fontFamily: "IBM Plex Sans, Arial, sans-serif",
              themeCSS: `.edgeLabel .background { fill: ${theme.background}; opacity: 1; }`,
              themeVariables: {
                primaryColor: theme.background,
                primaryTextColor: theme.foreground,
                primaryBorderColor: theme.border,
                secondaryColor: theme.muted,
                tertiaryColor: theme.accent,
                lineColor: theme.line,
                textColor: theme.foreground,
                edgeLabelBackground: theme.background,
              },
              flowchart: {
                htmlLabels: false,
                curve: "linear",
                padding: 16,
                nodeSpacing: 30,
                rankSpacing: 42,
                useMaxWidth: false,
              },
            });
            return (await window.mermaid.render(id, graph)).svg;
          },
          { graph, id: name, theme },
        );
        await writeFile(new URL(`${name}.svg`, output), svg);
        {
          const raster = await browser.newPage({
            viewport: { width: 1950, height: 1200 },
            deviceScaleFactor: 1,
          });
          await raster.setContent(
            `<style>body{margin:0;background:${theme.background}}svg{width:1950px;height:auto;display:block}</style>${svg}`,
          );
          await raster.locator("svg").screenshot({
            path: fileURLToPath(new URL(`${name}.png`, output)),
          });
          await raster.close();
        }
      }
      manifest.diagrams[name] = createHash("sha256")
        .update(source)
        .digest("hex");
    }
    await writeFile(
      new URL("diagram-manifest.json", output),
      JSON.stringify(manifest, null, 2) + "\n",
    );
    // Optional editable Excalidraw export using the diagram skill's offline bundle.
    if (process.env.MERMAID_EXCALIDRAW_BUNDLE) {
      await page.goto(
        pathToFileURL(process.env.MERMAID_EXCALIDRAW_BUNDLE).href,
      );
      await page.waitForFunction(
        () => typeof window.__mermaidToExcalidraw === "function",
      );
      for (const { name, source } of diagrams) {
        const scene = await page.evaluate(
          (source) => window.__mermaidToExcalidraw(source),
          source,
        );
        await writeFile(new URL(`${name}.excalidraw`, output), scene);
      }
    }
    console.log(
      "Rendered one horizontal Mermaid SVG and PNG preview offline for every screen.",
    );
  } finally {
    await browser.close();
  }
}
