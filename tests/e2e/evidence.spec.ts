import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const scenario of [
  { stage: "operations", name: "Nine Mile Point 1", source: "Reactor Oversight Process Action Matrix", date: "2025Q1", precision: "quarter", effective: "2025Q1", locator: "2025Q1; Nine Mile Point 1", field: "action_matrix_code", count: 4 },
  { stage: "build-license", name: "Fermi 3", source: "Combined License Holders for New Reactors", date: "2026-07-22", precision: "day", effective: "2015-05-01", locator: "Combined License Holders summary", field: "effective_date", count: 1 },
]) {
  test(`audit citation provenance for ${scenario.name}`, async ({ page }, testInfo) => {
    await page.goto(`/?stage=${scenario.stage}&view=table`);
    await page.getByRole("button", { name: `Inspect ${scenario.name}`, exact: true }).click();
    const inspector = testInfo.project.name === "mobile"
      ? page.getByRole("dialog", { name: "Evidence record" })
      : page.getByRole("complementary", { name: "Evidence details" });
    const citations = inspector.getByRole("region", { name: /^Citation:/ });
    await expect(citations).toHaveCount(scenario.count);
    const citation = inspector.getByRole("region", { name: `Citation: ${scenario.source}`, exact: true });
    for (const value of [scenario.date, scenario.precision, scenario.effective, scenario.locator, scenario.field, "Official Regulatory", "Approved"]) {
      await expect(citation.getByText(value, { exact: true }).first()).toBeVisible();
    }
    await expect(citation.getByText(/2026-08-26T.*Z/)).toBeVisible();
    await expect(citation.getByRole("link", { name: "Open source" })).toHaveAttribute("href", /^https:\/\/www\.nrc\.gov\//);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
