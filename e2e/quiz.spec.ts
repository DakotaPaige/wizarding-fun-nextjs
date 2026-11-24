import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const HOUSES = ["Gryffindor", "Slytherin", "Ravenclaw", "Hufflepuff"];

test.describe("the Sorting Ceremony", () => {
  // The web server runs with every AI var blanked, so this is always classic mode.
  test("plays a classic round and sends the player to their housemates", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto("/");
    const quiz = page.locator("section#sorting-ceremony");
    await quiz.scrollIntoViewIfNeeded();
    // No mode is claimed before the server has reported one; the Hat only stirs.
    await expect(quiz.getByText("The Hat is stirring…")).toBeVisible();
    await expect(quiz.getByText(/The Hat is (awake|resting)/)).toHaveCount(0);
    await quiz.getByRole("button", { name: "Put on the Hat" }).click();

    for (let turn = 1; turn <= 10; turn++) {
      await quiz.getByRole("button", { name: turn % 2 === 1 ? /^Dare/ : /^Play it safe/ }).click();
      const answers = quiz.getByRole("list", { name: "Answers" });
      await expect(answers).toBeVisible();
      if (turn === 1) {
        await expect(quiz.getByText("The Hat is resting · classic mode")).toBeVisible();
        await expect(quiz.getByText("Daring · 2 pts")).toBeVisible();
      }
      await expect(quiz.getByText(`Question ${turn} of 10`)).toBeVisible();
      await answers.getByRole("button").first().click();
      await expect(quiz.getByText(/^(Correct! \+\d points?\.|Not quite\. The answer was .+\.)$/)).toBeVisible();
      if (turn === 1) {
        const { violations } = await new AxeBuilder({ page }).include("#sorting-ceremony").analyze();
        expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
      }
      await quiz.getByRole("button", { name: turn === 10 ? /verdict/ : /Next question/ }).click();
    }

    const houseHeading = quiz.getByRole("heading", { level: 3, name: new RegExp(`^(${HOUSES.join("|")})!$`) });
    await expect(houseHeading).toBeVisible();
    await expect(quiz.getByText("— The Sorting Hat")).toBeVisible();
    await expect(quiz.getByRole("list", { name: "How you played" }).getByRole("listitem")).toHaveCount(4);
    await expect(quiz.getByText("The Hat is resting · classic mode")).toBeVisible();
    const house = (await houseHeading.textContent())!.replace("!", "");

    const { violations } = await new AxeBuilder({ page }).include("#sorting-ceremony").analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

    await quiz.getByRole("button", { name: "Meet your housemates" }).click();
    await expect(page.locator("section#great-hall")).toBeInViewport();
    await expect(page.getByRole("tab", { name: house })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: house })).toBeFocused();

    await quiz.getByRole("button", { name: "Play again" }).click();
    await expect(quiz.getByRole("button", { name: "Put on the Hat" })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("shows the error copy when the server fails and retries the same turn", async ({ page }) => {
    let failures = 1;
    const bodies: string[] = [];
    await page.route("**/api/graphql", async (route) => {
      const body = route.request().postData() ?? "";
      if (!body.includes("QuizTurn")) return route.continue();
      bodies.push(body);
      if (failures-- > 0) return route.fulfill({ status: 500, body: "{}" });
      return route.continue();
    });

    await page.goto("/");
    const quiz = page.locator("section#sorting-ceremony");
    await quiz.scrollIntoViewIfNeeded();
    await quiz.getByRole("button", { name: "Put on the Hat" }).click();
    await quiz.getByRole("button", { name: /^Dare/ }).click();

    await expect(quiz.getByRole("alert")).toHaveText("The Hat lost its train of thought — try again");
    await quiz.getByRole("button", { name: "Retry" }).click();
    await expect(quiz.getByRole("list", { name: "Answers" })).toBeVisible();
    await expect(quiz.getByText("Question 1 of 10")).toBeVisible();
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
  });
});
