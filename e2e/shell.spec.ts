import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("page shell", () => {
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

  test("the footer credits Potter DB and the Harry Potter Wiki licence", async ({ page }) => {
    await page.goto("/");
    const colophon = page.locator("footer");
    await expect(colophon).toContainText("Potter DB");
    await expect(colophon).toContainText("CC BY-SA");

    const potterDb = colophon.getByRole("link", { name: /^Potter DB/ });
    await expect(potterDb).toHaveAttribute("href", "https://potterdb.com");
    await expect(potterDb).toHaveAttribute("target", "_blank");
    const licence = colophon.getByRole("link", { name: /^CC BY-SA/ });
    await expect(licence).toHaveAttribute("href", "https://creativecommons.org/licenses/by-sa/4.0/");
    await expect(licence).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("the footer writes in when reached, even after the quiz changes the page height", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { name: "Mischief managed." });
    const letters = heading.locator("*");
    await expect(letters.first()).toHaveCSS("opacity", "0");

    // Where the write-in trigger was first placed: footer top at 85% of the viewport.
    const oldStart = await page.evaluate(() => {
      const footer = document.querySelector("footer")!;
      return footer.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.85;
    });
    // Grow the quiz section, as a quiz phase change does.
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "1500px";
      document.querySelector("section#sorting-ceremony")!.append(spacer);
    });
    await page.waitForTimeout(400);

    // Past the stale start position, the footer is still far below: nothing may have written in.
    await page.evaluate((y) => window.scrollTo({ top: y + 200, behavior: "instant" }), oldStart);
    await page.waitForTimeout(600);
    await expect(page.locator("footer")).not.toBeInViewport();
    await expect(letters.first()).toHaveCSS("opacity", "0");

    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await expect(letters.last()).toHaveCSS("opacity", "1");
  });
});
