import { expect, test } from "@playwright/test";

test.describe("reduced motion", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/hp-api.onrender.com/**", (route) => route.abort());
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("the intro is at rest immediately, with no sparkle canvas", async ({ page }) => {
    await page.goto("/");
    const title = page.getByRole("heading", { level: 1 });
    const tagline = page.locator("#top p[data-enter]");
    await expect(title).toHaveCSS("opacity", "1", { timeout: 100 });
    await expect(tagline).toHaveCSS("opacity", "1", { timeout: 100 });
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("casting a spell shows its heading within 500 ms", async ({ page }) => {
    await page.goto("/");
    const classroom = page.locator("section#classroom");
    await classroom.scrollIntoViewIfNeeded();
    const spell = classroom.getByRole("list", { name: "Spells" }).getByRole("button").nth(1);
    await spell.click();
    const name = ((await spell.textContent()) ?? "").trim();
    await expect(classroom.getByRole("heading", { level: 3, name })).toBeVisible({ timeout: 500 });
    await expect(classroom.getByRole("heading", { level: 3, name })).toHaveCSS("opacity", "1");
  });

  test("the footer sign-off is readable without scrolling in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Mischief managed." })).toHaveCSS("opacity", "1");
  });
});
