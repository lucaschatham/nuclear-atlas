import { expect, test } from "@playwright/test";

test("persona questions expand with sources and honest capability labels", async ({ page }) => {
  await page.goto("/about/#who-its-for");
  await expect(page.getByRole("heading", { name: "Who uses Nuclear Atlas?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "IAEA stakeholder framework", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Community Member", exact: true })).toBeVisible();
  const groups = page.locator("#product-contract details");
  await expect(groups).toHaveCount(15);
  for (const group of await groups.all()) {
    if (await group.getAttribute("open") === null) await group.locator("summary").click();
    await expect(group.locator("ol > li")).toHaveCount(5);
    await expect(group.getByRole("heading", { name: "Sources behind these questions" })).toBeVisible();
    expect(await group.getByRole("link").count()).toBeGreaterThanOrEqual(2);
    await group.locator("summary").click();
    await expect(group.locator("ol")).not.toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
