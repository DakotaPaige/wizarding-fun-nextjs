import { expect, test } from "@playwright/test";

test.describe("reduced motion", () => {
  test.beforeEach(async ({ page }) => {
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

  test("the footer sign-off is plain text, never split into hidden letters", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { name: "Mischief managed." });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toHaveCSS("opacity", "1");
    // With full motion SplitText wraps every letter in its own element (starting at opacity 0);
    // reduced motion must leave the heading as a bare text node.
    await expect(heading.locator("*")).toHaveCount(0);
    await expect(heading).toHaveText("Mischief managed.");
  });
});
