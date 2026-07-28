const { test, expect } = require("@playwright/test");

test("opens in the live world and sends an in-world chat action", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?ato-demo=1");
  await expect(page.locator("body")).toHaveAttribute("data-ato-ready", "true", {
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Say hello" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-ato-interaction", "chat");
  await expect(page.getByRole("button", { name: "Hello sent" })).toBeDisabled();
});
