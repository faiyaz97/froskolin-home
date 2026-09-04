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
  await expect(
    page.locator("header").getByRole("link", { name: "Household settings" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Upload bill" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add expense" })).toBeVisible();
  const primaryNavigation = page.getByRole("navigation", { name: "Primary" });
  await expect(primaryNavigation).toBeVisible();
  await expect(primaryNavigation.getByText("Add", { exact: true })).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    const navigationBox = await primaryNavigation.boundingBox();
    expect(navigationBox).not.toBeNull();
    expect(navigationBox!.width).toBeLessThanOrEqual(600);
    expect(Math.abs(navigationBox!.x + navigationBox!.width / 2 - 640)).toBeLessThan(2);
  }

  await page.getByRole("link", { name: "Add expense" }).click();
  const expenseTypeNavigation = page.getByRole("navigation", { name: "Expense type" });
  await expect(expenseTypeNavigation.getByRole("link", { name: "One-time" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(expenseTypeNavigation.getByRole("link", { name: "Recurring" })).toBeVisible();
  await expect(expenseTypeNavigation.getByRole("link", { name: "Utility bill" })).toBeVisible();

  const documentId = "11111111-1111-4111-8111-111111111111";
  await page.route("**/api/bills/upload", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ documentId, pageCount: 1 }),
    });
  });
  await page.route(`**/api/bills/${documentId}/extract`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        extraction: {
          supplier: "Froskolin Energy",
          utilityType: "electricity",
          billNumber: null,
          issueDate: "2026-09-01",
          servicePeriod: { start: "2026-08-01", end: "2026-08-31" },
          totalDueCents: 10_000,
          currency: "EUR",
          consumption: { amount: null, unit: null },
          charges: {
            consumptionCents: 6_000,
            fixedCents: 4_000,
            taxesCents: null,
            adjustmentsCents: null,
          },
          extractionConfidence: {
            servicePeriod: 0.99,
            totalDue: 0.99,
            fixedCharges: 0.99,
            consumptionCharges: 0.99,
          },
          evidence: {},
        },
      }),
    });
  });
  await expenseTypeNavigation.getByRole("link", { name: "Utility bill" }).click();
  const billForm = page.locator("#bill-facts");
  await expect(billForm.getByText("Manual", { exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "electricity.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("mock bill"),
  });
  await page.getByText("Use Gemini to read this bill", { exact: true }).click();
  await page.getByRole("button", { name: "Fill form with AI" }).click();
  await expect(billForm.getByText("AI-filled", { exact: true })).toBeVisible();
  await expect(billForm.getByLabel("Title")).toHaveValue("Froskolin Energy bill");
  await billForm.getByLabel("Title").fill("Edited electricity bill");
  await expect(billForm.getByText("Manual", { exact: true })).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });

  await primaryNavigation.getByRole("link", { name: "Account" }).click();
  await expect(page).toHaveURL(`${homeUrl}/account`);
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await page.getByRole("button", { name: "Violet avatar" }).click();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Personal settings saved.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Change personal PIN" })).toBeVisible();

  await page.goto(`${homeUrl}/settings`);
  await expect(page.getByRole("link", { name: "Change personal PIN" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await expect(page.locator("select")).toHaveCount(0);
  await page.getByRole("button", { name: "Default currency" }).click();
  await expect(page.getByRole("listbox", { name: "Default currency" })).toBeVisible();
  await page.getByRole("option", { name: "EUR" }).click();
  const accessSection = page.locator("aside section").filter({ hasText: "Household access" });
  const initialCode = (await accessSection.locator("dd").first().textContent())?.trim();
  expect(initialCode).toMatch(/^FROSKO-\d{4}$/);
  await expect(accessSection.getByText("654321", { exact: true })).toBeVisible();
  await page.goto(`${homeUrl}/account`);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  await expect(page.getByText(ownerName)).toBeVisible();
  await expect(page.getByLabel("House Code")).toHaveCount(0);
  await page.getByLabel("Personal PIN").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/);

  await page.goto(`${homeUrl}/settings`);
  const changedCode = `HOME-${suffix}`;
  await accessSection.getByRole("button", { name: "Edit household access" }).click();
  await accessSection.getByLabel("House Code").fill(changedCode);
  await accessSection.getByLabel("House Join PIN").fill("777777");
  await accessSection.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Household access saved.")).toBeVisible();
  await expect(accessSection.getByText(changedCode, { exact: true })).toBeVisible();
  await expect(accessSection.getByText("777777", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("froskolin.remembered-device.v1") ?? "null"),
      ),
    )
    .toMatchObject({ houseCode: changedCode, memberName: ownerName });

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

  await page.goto(`${homeUrl}/calendar`);
  const monthPrefix = new Date().toISOString().slice(0, 7);
  await page.locator(`[data-day="${monthPrefix}-10"] button`).click();
  await page.locator(`[data-day="${monthPrefix}-12"] button`).click();
  await page.getByRole("button", { name: "Add range" }).click();
  await page.getByRole("button", { name: "Confirm away periods" }).click();
  await expect(page.getByText("Away periods saved.")).toBeVisible();

  await page.getByRole("link", { name: memberName }).click();
  const awayEditor = page.locator('aside[aria-labelledby="periods-heading"]');
  await expect(awayEditor.getByText("0 days", { exact: true })).toBeVisible();
  await expect(awayEditor.getByRole("button", { name: "Confirm away periods" })).toBeDisabled();
  await expect(page.locator(`[data-day="${monthPrefix}-10"] button`)).toHaveAttribute(
    "aria-label",
    new RegExp(`Away: ${ownerName}`),
  );
  await expect(page.getByRole("region", { name: "Who’s away" }).getByText(ownerName)).toBeVisible();

  await secondContext.close();
});
