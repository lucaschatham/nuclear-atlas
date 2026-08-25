import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("map and table expose the same launch records", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nuclear projects, mapped to their public evidence." })).toBeVisible();
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

test("unsupported stages state a coverage gap", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Fuel Supply/ }).click();
  await expect(page.getByText("Coverage gap, not a known zero")).toBeVisible();
});

test("workspace has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main main")).toHaveCount(0);
  await page.getByLabel("Table view", { exact: true }).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
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
  await expect(page.getByRole("heading", { name: "Nuclear projects, mapped to their public evidence." })).toBeVisible();
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
  await page.route("https://tiles.openfreemap.org/styles/liberty", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText("Map tiles are unavailable")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-slot=table-body] tr")).toHaveCount(17);
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("repeated map resource failures trigger the table fallback", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One failure-path check is sufficient");
  await page.route("https://tiles.openfreemap.org/**", (route) => {
    if (route.request().url().endsWith("/styles/liberty")) return route.continue();
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
  let failuresRemaining = 3;
  await page.route("https://tiles.openfreemap.org/**", (route) => {
    if (route.request().url().endsWith("/styles/liberty")) return route.continue();
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

test("a sustained map outage after initial load triggers fallback", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One outage transition check is sufficient");
  await page.goto("/");
  await expect(page.locator(".atlas-evidence-marker")).toHaveCount(17);
  await page.getByLabel("Table view", { exact: true }).click();
  await page.locator("[data-slot=table-body] tr").first().click();
  await page.route("https://tiles.openfreemap.org/**", (route) => route.abort());
  await page.getByLabel("Map view", { exact: true }).click();
  await expect(page.getByText("Map tiles are unavailable")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-slot=table-body] tr")).toHaveCount(17);
});
