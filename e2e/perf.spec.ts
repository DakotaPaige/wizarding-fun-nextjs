import { expect, test } from "@playwright/test";

test("the intro entrance causes no meaningful layout shift (CLS < 0.1)", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!entry.hadRecentInput) w.__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto("/");
  await page.waitForTimeout(4000);

  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  test.info().annotations.push({ type: "CLS", description: `${test.info().project.name}: ${cls}` });
  expect(cls).toBeLessThan(0.1);
});
