import { expect, test } from "@playwright/test";

const smokeCredentials = {
  groupCode: process.env.SMOKE_GROUP_CODE,
  memberName: process.env.SMOKE_MEMBER_NAME,
  personalPin: process.env.SMOKE_PERSONAL_PIN,
};

test("public entry and sign-in load without mobile overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Create group" })).toBeVisible();

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Group code")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("dedicated QA account can read the main authenticated pages", async ({ page }) => {
  const { groupCode, memberName, personalPin } = smokeCredentials;
  expect(groupCode, "SMOKE_GROUP_CODE must be configured").toBeTruthy();
  expect(memberName, "SMOKE_MEMBER_NAME must be configured").toBeTruthy();
  expect(personalPin, "SMOKE_PERSONAL_PIN must be configured").toBeTruthy();

  await page.goto("/login");
  await page.getByLabel("Group code").fill(groupCode!);
  await page.getByLabel("Your name").fill(memberName!);
  await page.getByLabel("Personal PIN").fill(personalPin!);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 20_000 });
  const homePath = new URL(page.url()).pathname;
  await expect(page.getByRole("link", { name: "Group settings" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Balances/ })).toBeVisible();

  for (const [path, heading] of [
    ["balances", "Balances"],
    ["activity", "Activity"],
  ]) {
    await page.goto(`${homePath}/${path}`);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow, `${path} should fit the viewport`).toBe(false);
  }

  await page.goto(`${homePath}/settings`);
  await expect(page.getByRole("region", { name: "Group preferences" })).toBeVisible();
  const settingsOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(settingsOverflow, "settings should fit the viewport").toBe(false);
});
