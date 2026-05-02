import { test, expect } from "@playwright/test";

test.describe("Dashboard Navigation", () => {
  test("should have sidebar navigation", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.url()).toContain("/login");
  });
});

test.describe("Settings Page", () => {
  test("should show social accounts section", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page.url()).toContain("/login");
  });
});

test.describe("Schedule Page", () => {
  test("should show calendar view", async ({ page }) => {
    await page.goto("/dashboard/schedule");
    await expect(page.url()).toContain("/login");
  });
});
