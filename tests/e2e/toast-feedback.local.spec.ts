import { expect, test } from "@playwright/test";

test("action feedback stays visible on a narrow phone without scrolling to the top", async ({
  page,
}, testInfo) => {
  const suffix = Date.now().toString().slice(-7);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mode=create");
  await page.getByLabel("Group name").fill(`Toast test ${suffix}`);
  await page.getByLabel("Group PIN").fill("654321");
  await page.getByLabel("Your name").fill(`Owner ${suffix}`);
  await page.getByLabel("Personal PIN").fill("123456");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 15_000 });
  const homePath = new URL(page.url()).pathname;

  await page.goto(`${homePath}/settings`);
  await page.getByRole("switch", { name: "Allow people to join" }).click();
  const success = page.getByRole("status").filter({ hasText: "Group settings saved." });
  await expect(success).toBeVisible();
  const successBox = await success.boundingBox();
  expect(successBox).not.toBeNull();
  expect(successBox!.y).toBeGreaterThan(500);
  await page.screenshot({ path: testInfo.outputPath("success-mobile.png") });
  await page.setViewportSize({ width: 320, height: 720 });
  const narrowBox = await success.boundingBox();
  expect(narrowBox).not.toBeNull();
  expect(narrowBox!.x).toBeGreaterThanOrEqual(0);
  expect(narrowBox!.x + narrowBox!.width).toBeLessThanOrEqual(320);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`${homePath}/account`);
  await page.getByRole("button", { name: "Change personal PIN" }).click();
  const pinDialog = page.getByRole("dialog", { name: "Change personal PIN" });
  await pinDialog.getByLabel("Current or temporary PIN").fill("000000");
  await pinDialog.getByLabel("New personal PIN").fill("234567");
  await pinDialog.getByLabel("Confirm new PIN").fill("234567");
  await pinDialog.getByRole("button", { name: "Done" }).click();
  const failure = page
    .getByRole("alert")
    .filter({ has: page.getByRole("button", { name: "Dismiss message" }) });
  await expect(failure).toBeVisible();
  const failureBox = await failure.boundingBox();
  expect(failureBox).not.toBeNull();
  expect(failureBox!.y).toBeGreaterThan(500);
  await page.screenshot({ path: testInfo.outputPath("error-mobile.png") });
  await failure.getByRole("button", { name: "Dismiss message" }).click();
  await expect(failure).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${homePath}/settings`);
  await page.getByRole("switch", { name: "Allow people to join" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Group settings saved." })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("success-desktop.png") });
});
