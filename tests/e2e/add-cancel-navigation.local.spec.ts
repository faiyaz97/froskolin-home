import { expect, test } from "@playwright/test";

test("add expense and utility bill cancel back to group home", async ({ page }) => {
  const suffix = Date.now().toString().slice(-7);

  await page.goto("/?mode=create");
  await page.getByLabel("Group name").fill(`Cancel test ${suffix}`);
  await page.getByLabel("Your name").fill(`Owner ${suffix}`);
  await page.getByLabel("Group PIN").fill("654321");
  await page.getByLabel("Personal PIN").fill("123456");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 15_000 });
  const homeUrl = page.url();

  await page.goto(`${homeUrl}/add/expense`);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(homeUrl);

  await page.goto(`${homeUrl}/add/bill`);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(homeUrl);
});
