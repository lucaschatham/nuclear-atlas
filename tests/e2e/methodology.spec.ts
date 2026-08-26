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
    page.getByRole("heading", { name: "How Nuclear Atlas works." }),
  ).toBeVisible();
  await expect(page.locator("[data-source-id]")).toHaveCount(registry.length);
  await expect(page.locator("[data-workflow-diagram]")).toHaveCount(1);
  await expect(
    page.locator("[data-workflow-diagram] [data-source-id]"),
  ).toHaveCount(registry.length);
  await expect(page.locator("[data-source-connection]")).toHaveCount(
    registry.length,
  );
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

test("methodology diagrams render offline and the storage decision stays explicit", async ({
  page,
}) => {
  await page.route("https://**/*", (route) => route.abort());
  await page.goto("/about/");
  await expect(page.locator("[data-workflow-diagram]")).toHaveCount(1);
  await expect(page.locator("[data-workflow-step]")).toHaveCount(5);
  const svg = await page.request.get("/methodology/workflow.svg");
  expect(svg.ok()).toBe(true);
  expect(await svg.text()).toContain("<svg");
  await expect(
    page.getByRole("heading", { name: "Storage is an open decision." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download PRD" }),
  ).toHaveAttribute("href", "/methodology/nuclear-atlas-prd.md");
  const response = await page.request.get("/methodology/nuclear-atlas-prd.md");
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("Storage is an open decision");
});

test("methodology fits mobile and desktop and has no serious accessibility violations", async ({
  page,
}, testInfo) => {
  await page.goto("/about/");
  const widths = testInfo.project.name === "mobile" ? [390, 768] : [1440, 1920];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("[data-workflow-step]")).toHaveCount(5);
    const viewport = page
      .locator("[data-workflow-diagram] [data-slot=scroll-area-viewport]")
      .first();
    await expect
      .poll(() =>
        viewport.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        ),
      )
      .toBe(true);
    await viewport.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect
      .poll(() => viewport.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
    await viewport.evaluate((element) => {
      element.scrollLeft = 0;
    });
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
