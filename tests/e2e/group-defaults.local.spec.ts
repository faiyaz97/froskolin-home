import { expect, test } from "@playwright/test";

test("new groups start in EUR and switch Balance Mode with Landlord mode", async ({ page }) => {
  test.setTimeout(90_000);
  const suffix = Date.now().toString().slice(-7);
  await page.goto("/?mode=create");
  await page.getByLabel("Group name").fill(`Defaults test ${suffix}`);
  await page.getByLabel("Your name").fill(`Owner ${suffix}`);
  await page.getByLabel("Group PIN").fill("654321");
  await page.getByLabel("Personal PIN").fill("123456");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 15_000 });
  await page.goto(`${page.url()}/settings`);
  await expect(page.getByRole("button", { name: "Group currency EUR" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Balance Mode Simplified" })).toBeVisible();

  const landlordMode = page.getByRole("switch", { name: "Landlord mode" });
  await landlordMode.click();
  await expect(page.getByRole("button", { name: "Balance Mode Combined" })).toBeVisible();
  await expect(landlordMode).toBeEnabled();
  await landlordMode.click();
  await expect(page.getByRole("button", { name: "Balance Mode Simplified" })).toBeVisible();
});
