import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const severe = async (builder: AxeBuilder) => {
  const { violations } = await builder.analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
};

const isSheet = (page: Page) => (page.viewportSize()?.width ?? 1280) < 640;
const hall = (page: Page) => page.locator("section#great-hall");
const roster = (page: Page) => hall(page).getByRole("tabpanel");

test.describe("the Great Hall", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("opens a character, traps focus and returns it to the card, by keyboard alone", async ({ page }) => {
    // Tab from the top of the page until the house tabs have focus.
    let onTabs = false;
    for (let i = 0; i < 80 && !onTabs; i++) {
      await page.keyboard.press("Tab");
      onTabs = await page.evaluate(() => document.activeElement?.getAttribute("role") === "tab");
    }
    expect(onTabs).toBe(true);
    await expect(page.getByRole("tab", { name: "Gryffindor" })).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Ravenclaw" })).toBeFocused();
    await expect(page.getByRole("tab", { name: "Ravenclaw" })).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Tab");
    const card = roster(page).getByRole("button", { name: /Luna Lovegood/ });
    await expect(card).toBeFocused();

    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Luna Lovegood" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(card).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("shows a patchy record gracefully, walks the roster and passes axe", async ({ page }) => {
    await hall(page).scrollIntoViewIfNeeded();
    await page.getByRole("tab", { name: "Ravenclaw" }).click();
    await roster(page).getByRole("button", { name: /Moaning Myrtle/ }).click();

    const dialog = page.getByRole("dialog", { name: "Moaning Myrtle" });
    await expect(dialog).toBeVisible();
    for (const term of ["Wand", "Patronus", "Born"]) {
      await expect(dialog.locator("dt", { hasText: term }).locator("+ dd")).toHaveText("Unknown");
    }
    await expect(dialog.locator("dt", { hasText: "Status" }).locator("+ dd")).toHaveText("Deceased");
    await page.waitForTimeout(800); // let the panel land before scanning it
    expect(await severe(new AxeBuilder({ page }).include('[role="dialog"]'))).toEqual([]);

    await dialog.getByRole("button", { name: "Next: Xenophilius Lovegood" }).click();
    await expect(page.getByRole("dialog", { name: "Xenophilius Lovegood" })).toBeVisible();

    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(roster(page).getByRole("button", { name: /Xenophilius Lovegood/ })).toBeFocused();
  });

  test("keeps the Slytherin palette accessible", async ({ page }) => {
    await hall(page).scrollIntoViewIfNeeded();
    await page.getByRole("tab", { name: "Slytherin" }).click();
    await expect(roster(page).getByRole("button", { name: /Draco Malfoy/ })).toBeVisible();
    // Let the palette tween and roster swap settle before measuring contrast.
    await page.waitForTimeout(1200);
    expect(await severe(new AxeBuilder({ page }).include("#great-hall"))).toEqual([]);
  });

  test("on a phone, the sheet closes when dragged down far enough", async ({ page }) => {
    test.skip(!isSheet(page), "the bottom sheet is the mobile layout");
    await hall(page).scrollIntoViewIfNeeded();
    await roster(page).getByRole("button", { name: /Harry Potter/ }).click();
    const dialog = page.getByRole("dialog", { name: "Harry Potter" });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(800);

    const box = (await dialog.boundingBox())!;
    const grabX = box.x + box.width / 3;
    const grabY = box.y + 60;
    const drag = async (distance: number) => {
      await page.mouse.move(grabX, grabY);
      await page.mouse.down();
      await page.mouse.move(grabX, grabY + distance, { steps: 8 });
      await page.mouse.up();
    };

    // A short drag settles back.
    await drag(box.height * 0.15);
    await page.waitForTimeout(400);
    await expect(dialog).toBeVisible();
    expect((await dialog.boundingBox())!.y).toBeCloseTo(box.y, 0);

    // Past 30 % of its height it closes, and focus goes back to the card.
    await drag(box.height * 0.45);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(roster(page).getByRole("button", { name: /Harry Potter/ })).toBeFocused();
  });
});
