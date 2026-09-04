import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const registry = JSON.parse(
  readFileSync(
    new URL("../../data/credibility/sources.json", import.meta.url),
    "utf8",
  ),
) as { id: string; operational_state: string }[];

test("methodology shows the complete source inventory and working filters", async ({
  page,
}) => {
  await page.goto("/about/");
  await expect(
    page.getByRole("heading", { name: "About Nuclear Atlas" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Sources", exact: true }).click();
  await expect(page.locator("[data-source-id]")).toHaveCount(registry.length);
  const firstSource = page.locator("[data-source-id]").first();
  await firstSource.getByRole("button").click();
  await expect(
    firstSource.getByRole("link", { name: "Open source" }),
  ).toBeVisible();
  await firstSource.getByRole("button").click();
  const positions = await page
    .locator("[data-source-id]")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { left: box.left, top: box.top };
      }),
    );
  expect(
    positions.every((position) => position.left === positions[0].left),
  ).toBe(true);
  expect(
    positions.every(
      (position, index) =>
        index === 0 || position.top > positions[index - 1].top,
    ),
  ).toBe(true);
  await page
    .getByRole("textbox", { name: "Search data sources" })
    .fill("spent fuel");
  await expect(page.locator('[data-source-id="nrc-spent-fuel"]')).toHaveCount(
    1,
  );
  await page
    .getByRole("textbox", { name: "Search data sources" })
    .fill("no-such-source-xyz");
  await expect(page.getByText("No sources match these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Reset source filters" }).click();
  await expect(page.locator("[data-source-id]")).toHaveCount(registry.length);
  await page.getByRole("combobox", { name: "Collection state" }).click();
  await page
    .getByRole("option", { name: "Automated collection", exact: true })
    .click();
  await expect(page.locator("[data-source-id]")).toHaveCount(
    registry.filter(
      (source) => source.operational_state === "approved_automated",
    ).length,
  );
});

test("methodology diagrams render offline and local storage is explained", async ({
  page,
}) => {
  await page.route("https://**/*", (route) => route.abort());
  await page.goto("/about/");
  await expect(page.locator("[data-workflow-diagram]")).toHaveCount(1);
  await expect(page.locator("[data-workflow-step]")).toHaveCount(4);
  const svg = await page.request.get("/methodology/workflow.svg");
  expect(svg.ok()).toBe(true);
  expect(await svg.text()).toContain("<svg");
  await page.getByText("Storage and downloads", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Simple storage, reviewed releases" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download PRD" }),
  ).toHaveAttribute("href", "/methodology/nuclear-atlas-prd.md");
  const response = await page.request.get("/methodology/nuclear-atlas-prd.md");
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("Local SQLite");
});

test("methodology fits mobile and desktop and has no serious accessibility violations", async ({
  page,
}, testInfo) => {
  await page.goto("/about/");
  const widths = testInfo.project.name === "mobile" ? [390, 768] : [1440, 1920];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("[data-workflow-step]")).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`methodology-${width}.png`),
    });
    await page
      .locator("#workflow")
      .screenshot({ path: testInfo.outputPath(`workflow-${width}.png`) });
  }
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
});

const tabs = ["How It Works", "Who It’s For", "Sources", "Fact Checks", "Coverage"];

test("methodology uses compact top tabs with one accessible panel", async ({ page }, testInfo) => {
  await page.goto("/about/");
  const list = page.getByRole("tablist", { name: "About Nuclear Atlas" });
  await expect(list.getByRole("tab")).toHaveCount(5);
  const box = await list.boundingBox();
  expect(box!.y).toBeLessThan(250);
  for (const name of tabs) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`tab-${tabs.indexOf(name)}.png`) });
  }
  await page.getByRole("tab", { name: "How It Works", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "Who It’s For", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("existing methodology section links select their containing tab", async ({ page }) => {
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 600 });
  await page.goto("/about/#evidence-rules");
  await expect(page.getByRole("tab", { name: "Fact Checks", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.goto("/about/#source-inventory");
  await expect(page.getByRole("textbox", { name: "Search data sources" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.evaluate(() => { window.location.hash = "storage"; });
  await expect(page.locator("details#storage")).toHaveAttribute("open", "");
  await expect(page.getByRole("heading", { name: "Simple storage, reviewed releases" })).toBeVisible();
});

 test("overview is concise and every tab fits without horizontal scrolling", async ({ page }) => {
  await page.goto("/about/");
  await expect(page.getByRole("list", { name: "Publishing process" }).getByRole("listitem")).toHaveCount(4);
  await expect(page.getByText("Source cutoff: August 26, 2026", { exact: false })).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of await page.getByRole("tab").all()) {
      const box = await tab.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
});
