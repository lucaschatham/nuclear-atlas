import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("globe loads vector tiles and renders geography, not just markers", async ({ page }) => {
  const tile = page.waitForResponse(
    (response) => /tiles\.openfreemap\.org\/planet\/.*\.pbf/.test(response.url()) && response.ok(),
    { timeout: 20_000 },
  );
  await Promise.all([page.goto("/"), tile]);
  await expect(page.locator(".atlas-map-surface")).toHaveAttribute("data-basemap-ready", "true", { timeout: 15_000 });
  await expect(page.locator(".atlas-evidence-marker")).toHaveCount(17);
});

test("a stalled map worker falls back to the table and can retry", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name !== "desktop", "One worker failure-path check is sufficient");
  // A valid, inert module reproduces a worker that starts but never answers.
  await page.route("**/maplibre/maplibre-gl-worker.mjs", (route) => route.fulfill({
    contentType: "text/javascript", body: "/* stalled worker */",
  }));
  await page.goto("/?q=crane");
  await expect(page.getByText("Map tiles are unavailable")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-slot=table-body] tr")).toHaveCount(1);
  await page.unroute("**/maplibre/maplibre-gl-worker.mjs");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".atlas-map-surface")).toHaveAttribute("data-basemap-ready", "true", { timeout: 20_000 });
  await expect(page).toHaveURL(/q=crane/);
  await expect(page.locator(".atlas-evidence-marker")).toHaveCount(1);
});

test("map and table expose the same launch records", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nuclear Atlas" })).toBeVisible();
  await page.getByLabel("Table view", { exact: true }).click();
  await expect(page.locator("[data-slot=table-body] tr")).toHaveCount(17);
  await page.locator("[data-slot=table-body] tr").first().click();
  if (testInfo.project.name === "mobile") {
    await expect(page.getByRole("dialog", { name: "Evidence record" })).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.locator("aside[aria-label='Evidence details']").getByText("Evidence record", { exact: true })).toBeVisible();
  }
  await page.getByLabel("Map view", { exact: true }).click();
  const selectedMarker = page.locator(".atlas-evidence-marker[data-selected=true]");
  await expect(selectedMarker).toHaveCount(1);
  await expect.poll(async () => {
    const [map, marker] = await Promise.all([
      page.locator(".atlas-map-surface").boundingBox(),
      selectedMarker.boundingBox(),
    ]);
    if (!map || !marker) return Number.POSITIVE_INFINITY;
    return Math.abs((map.x + map.width / 2) - (marker.x + marker.width / 2));
  }).toBeLessThan(80);
});

test("every lifecycle stage exposes cited snapshot records", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Fuel Supply/ }).click();
  await page.getByLabel("Table view", { exact: true }).click();
  await expect(page.locator("[data-slot=table-body] tr")).toHaveCount(12);
  await page.locator("[data-slot=table-body] tr").first().click();
  await expect(page.getByText("Evidence", { exact: true }).last()).toBeVisible();
});

test("workspace has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main main")).toHaveCount(0);
  await page.getByLabel("Table view", { exact: true }).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
});

test("every route uses the light visual system", async ({ page }) => {
  for (const path of ["/", "/about", "/changelog", "/deal/microsoft-constellation-crane-restart"]) {
    await page.goto(path);
    const theme = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas color check unavailable");
      context.fillStyle = body.backgroundColor;
      context.fillRect(0, 0, 1, 1);
      return {
        colorScheme: root.colorScheme,
        backgroundRgb: [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)],
      };
    });
    expect(theme.colorScheme).toBe("light");
    expect(theme.backgroundRgb.every((channel) => channel > 240)).toBe(true);
  }
});

test("desktop utility bar keeps filters and downloads explicit", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop utility bar test");
  await page.goto("/");

  await expect(page.getByLabel("Technology")).toContainText("All technologies");
  await expect(page.getByLabel("Evidence strength")).toContainText("All evidence strengths");
  await expect(page.getByLabel("Location precision")).toContainText("All locations");
  await expect(page.getByRole("button", { name: "Download" })).toHaveCount(1);
  await page.getByRole("button", { name: "Download" }).click();
  await expect(page.getByRole("menuitem", { name: "Download CSV" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Download JSON" })).toBeVisible();
  await expect(page.getByLabel("Atlas view")).toBeVisible();
});

test("lifecycle stages have visible button affordances", async ({ page }) => {
  await page.goto("/");
  const active = page.getByRole("tab", { name: /Projects/ });
  const inactive = page.getByRole("tab", { name: /Fuel Supply/ });
  const [activeStyle, inactiveStyle] = await Promise.all([
    active.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, border: style.borderTopColor, width: style.borderTopWidth };
    }),
    inactive.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, border: style.borderTopColor, width: style.borderTopWidth };
    }),
  ]);

  expect(activeStyle.width).toBe("1px");
  expect(inactiveStyle.width).toBe("1px");
  expect(activeStyle.background).not.toBe(inactiveStyle.background);
  expect(activeStyle.border).not.toBe("rgba(0, 0, 0, 0)");
});

test("workspace renders when persona storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage disabled", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage disabled", "SecurityError");
    };
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nuclear Atlas" })).toBeVisible();
  await page.getByLabel("Table view", { exact: true }).click();
  await expect(page.locator("[data-slot=table-body] tr")).toHaveCount(17);
});

test("mobile uses drawers instead of compressed desktop rails", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile composition test");
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Filters/ })).toBeVisible();
  await page.getByRole("button", { name: /Filters/ }).click();
  await expect(page.getByRole("heading", { name: "Filter the atlas" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Layers" }).click();
  await expect(page.getByRole("heading", { name: "Map layers" })).toBeVisible();
  await expect(page.locator("aside[aria-label='Map layers']")).toBeHidden();
});

test("map failure preserves every record in the table", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One failure-path check is sufficient");
  await page.route("https://tiles.openfreemap.org/styles/bright", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText("Map tiles are unavailable")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-slot=table-body] tr")).toHaveCount(17);
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("repeated map resource failures trigger the table fallback", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One failure-path check is sufficient");
  await page.route("https://tiles.openfreemap.org/**", (route) => {
    if (route.request().url().includes("/styles/bright")) return route.continue();
    return route.abort();
  });
  await page.goto("/");
  await expect(page.getByText("Map tiles are unavailable")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-slot=table-body] tr")).toHaveCount(17);
});

test("layer controls keep one location class visible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop exposes the persistent layer rail");
  await page.goto("/");
  await page.getByRole("switch", { name: "Show approximate areas" }).click();
  await expect(page.getByRole("switch", { name: "Show exact sites" })).toBeDisabled();
  await expect(page.locator(".atlas-evidence-marker[data-precision=approximate]")).toHaveCount(0);
});

test("recoverable map resource errors do not eject users", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One resilience check is sufficient");
  let failuresRemaining = 1;
  await page.route("https://tiles.openfreemap.org/**", (route) => {
    if (route.request().url().includes("/styles/bright")) return route.continue();
    if (failuresRemaining > 0) {
      failuresRemaining -= 1;
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/");
  await expect(page.locator(".atlas-evidence-marker")).toHaveCount(17);
  await page.waitForTimeout(4500);
  await expect(page.getByText("Map tiles are unavailable")).toHaveCount(0);
});

test("narrow desktop widths retain filter access", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This checks the gap between lg and xl");
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: /Filters/ }).click();
  await expect(page.getByRole("heading", { name: "Filter the atlas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Layers" })).toBeHidden();
});

test("a sustained map outage after initial load triggers fallback", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One outage transition check is sufficient");
  await page.goto("/");
  await expect(page.locator(".atlas-map-surface")).toHaveAttribute("data-basemap-ready", "true", { timeout: 20_000 });
  await page.getByLabel("Table view", { exact: true }).click();
  await page.locator("[data-slot=table-body] tr").first().click();
  // Vector tile requests now run in the worker, not just the page.
  await context.route("https://tiles.openfreemap.org/**", (route) => route.abort());
  await page.getByLabel("Map view", { exact: true }).click();
  await expect(page.getByText("Map tiles are unavailable")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-slot=table-body] tr")).toHaveCount(17);
});
