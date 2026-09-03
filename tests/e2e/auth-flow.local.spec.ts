import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("create, remembered login, access rotation, failed login, and join", async ({
  browser,
  page,
}) => {
  const suffix = Date.now().toString().slice(-7);
  const ownerName = `Owner ${suffix}`;
  const memberName = `Roommate ${suffix}`;

  await page.goto("/?mode=create");
  await page.getByLabel("Household name").fill(`Auth test ${suffix}`);
  await page.getByLabel("Owner name").fill(ownerName);
  await page.getByLabel("House Join PIN").fill("654321");
  await page.getByLabel("Personal PIN").fill("123456");
  await page.getByRole("button", { name: "Create household" }).click();

  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/);
  const homeUrl = page.url();
  const primaryNavigation = page.getByRole("navigation", { name: "Primary" });
  await expect(primaryNavigation).toBeVisible();
  await expect(primaryNavigation.getByText("Add", { exact: true })).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    const navigationBox = await primaryNavigation.boundingBox();
    expect(navigationBox).not.toBeNull();
    expect(navigationBox!.width).toBeLessThanOrEqual(520);
    expect(Math.abs(navigationBox!.x + navigationBox!.width / 2 - 640)).toBeLessThan(2);
  }

  await page.goto(`${homeUrl}/settings`);
  await expect(page.locator("select")).toHaveCount(0);
  await page.getByRole("button", { name: "Default currency" }).click();
  await expect(page.getByRole("listbox", { name: "Default currency" })).toBeVisible();
  await page.getByRole("option", { name: "EUR" }).click();
  const accessSection = page.locator("aside section").filter({ hasText: "Household access" });
  const initialCode = (await accessSection.locator("code").textContent())?.trim();
  expect(initialCode).toMatch(/^FROSKO-\d{4}$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  await expect(page.getByText(ownerName)).toBeVisible();
  await expect(page.getByLabel("House Code")).toHaveCount(0);
  await page.getByLabel("Personal PIN").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/);

  await page.goto(`${homeUrl}/settings`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Change House Code" }).click();
  await expect(page.getByText("House Code changed.")).toBeVisible();
  const changedCode = (await accessSection.locator("code").textContent())?.trim();
  expect(changedCode).toMatch(/^FROSKO-\d{4}$/);
  expect(changedCode).not.toBe(initialCode);
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("froskolin.remembered-device.v1") ?? "null"),
      ),
    )
    .toMatchObject({ houseCode: changedCode, memberName: ownerName });

  await page.getByLabel("New 6-digit Join PIN").fill("777777");
  await page.getByLabel("Confirm Join PIN").fill("777777");
  await page.getByRole("button", { name: "Change Join PIN" }).click();
  await expect(page.getByText("House Join PIN changed.")).toBeVisible();

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await secondPage.goto("/login");
  await secondPage.getByLabel("House Code").fill(changedCode!);
  await secondPage.getByLabel("Member name").fill(memberName);
  await secondPage.getByLabel("Personal PIN").fill("222222");
  await secondPage.getByRole("button", { name: "Sign in" }).click();
  await expect(secondPage.getByText("We couldn't sign you in with those details.")).toBeVisible();

  await secondPage.goto("/?mode=join");
  await secondPage.getByLabel("House Code").fill(changedCode!);
  await secondPage.getByLabel("Your name").fill(memberName);
  await secondPage.getByLabel("House Join PIN").fill("777777");
  await secondPage.getByLabel("Personal PIN").fill("222222");
  await secondPage.getByRole("button", { name: "Join roommates" }).click();
  await expect(secondPage).toHaveURL(/\/h\/[0-9a-f-]+$/);
  await secondContext.close();
});
