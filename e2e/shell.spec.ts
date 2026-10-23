import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("page shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/hp-api.onrender.com/**", (route) => route.abort());
  });

  test("renders every section without console errors or serious a11y violations", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto("/");

    for (const id of ["top", "classroom", "great-hall", "sorting-ceremony"]) {
      const section = page.locator(`section#${id}`);
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
    }
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).analyze();
    const severe = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(severe.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("map navigation jumps to a section", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Map" });
    const mapButton = nav.getByRole("button", { name: "Map" });

    const compact = (page.viewportSize()?.width ?? 1280) < 640;
    if (compact) {
      await expect(mapButton).toHaveAttribute("aria-expanded", "false");
      await mapButton.click();
      await expect(mapButton).toHaveAttribute("aria-expanded", "true");
    } else {
      await expect(mapButton).toBeHidden();
    }

    await nav.getByRole("link", { name: "The Sorting Ceremony" }).click();
    await expect(page).toHaveURL(/#sorting-ceremony$/);
    await expect(page.locator("section#sorting-ceremony")).toBeInViewport();
  });
});
