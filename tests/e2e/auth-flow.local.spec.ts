import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

test("create, remembered login, access rotation, failed login, and join", async ({
  browser,
  page,
}, testInfo) => {
  const suffix = Date.now().toString().slice(-7);
  const ownerName = `Owner ${suffix}`;
  const memberName = `Roommate ${suffix}`;

  await page.goto("/?mode=create");
  await page.getByLabel("Household name").fill(`Auth test ${suffix}`);
  await page.getByLabel("Owner name").fill(ownerName);
  await page.getByLabel("House Join PIN").fill("654321");
  await page.getByLabel("Personal PIN").fill("123456");
  await page.getByRole("button", { name: "Create household" }).click();

  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 15_000 });
  const homeUrl = page.url();
  await expect(page.getByRole("link", { name: "Household settings" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Notifications/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Upload bill" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add expense" })).toBeVisible();
  const primaryNavigation = page.getByRole("navigation", { name: "Primary" });
  await expect(primaryNavigation).toBeVisible();
  const appBrand = page.getByRole("link", { name: "Froskolin Home" });
  if ((page.viewportSize()?.width ?? 0) < 768) await expect(appBrand).toBeHidden();
  else await expect(appBrand).toBeVisible();
  await expect(primaryNavigation.getByText("Add", { exact: true })).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    const navigationBox = await primaryNavigation.boundingBox();
    expect(navigationBox).not.toBeNull();
    expect(navigationBox!.width).toBeLessThanOrEqual(600);
    expect(Math.abs(navigationBox!.x + navigationBox!.width / 2 - 640)).toBeLessThan(2);
  }

  await page.getByRole("link", { name: "Add expense" }).click();
  const expenseTypeNavigation = page.getByRole("navigation", { name: "Expense type" });
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await expect(primaryNavigation).toBeHidden();
    await expect(page.getByRole("button", { name: "Go back" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  }
  await expect(expenseTypeNavigation.getByRole("link", { name: "Expense" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(expenseTypeNavigation.getByRole("link", { name: "Recurring" })).toHaveCount(0);
  await expect(expenseTypeNavigation.getByRole("link", { name: "Utility bill" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Paid by" })).toContainText("You");
  await expect(page.getByRole("button", { name: "Split method" })).toContainText("Equally");
  await expect(page.getByRole("button", { name: /Date \d{4}-\d{2}-\d{2}/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add attachment", exact: true })).toBeVisible();
  await expect(page.getByText("Everyone", { exact: true })).toBeVisible();
  await expect(page.getByText("Repeat monthly", { exact: true })).toHaveCount(0);
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBe(viewport.clientWidth);
  const dateDialog = page.getByRole("dialog", { name: "Date", exact: true });
  await expect(async () => {
    await page.getByRole("button", { name: /Date \d{4}-\d{2}-\d{2}/ }).click();
    await expect(dateDialog).toBeVisible();
  }).toPass({ timeout: 15_000 });
  await dateDialog.getByRole("button", { name: "Monthly" }).click();
  await dateDialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: /Monthly from/ })).toBeVisible();

  let persistentUploadRequests = 0;
  await page.route("**/api/bills/upload", async (route) => {
    persistentUploadRequests += 1;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        documentId: "11111111-1111-4111-8111-111111111111",
        pageCount: 1,
      }),
    });
  });
  await page.route("**/api/bills/extract", async (route) => {
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
  await page.goto(`${homeUrl}/add/bill`);
  const billForm = page.locator("#bill-facts");
  await expect(page.getByText("Manual entry", { exact: true })).toBeVisible();
  await expect(billForm.getByLabel(/Supplier/)).toHaveCount(0);
  await expect(billForm.getByLabel("Issue date", { exact: true })).toHaveCount(0);
  await expect(billForm.getByLabel("Notes (optional)", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("utility-bill-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("utility-bill-mobile.png") });
  const fixedFeesBox = await billForm.getByLabel("Fixed fees", { exact: true }).boundingBox();
  const usageCostsBox = await billForm.getByLabel("Usage costs", { exact: true }).boundingBox();
  expect(fixedFeesBox!.y).toBeCloseTo(usageCostsBox!.y, 0);
  expect(fixedFeesBox!.width).toBeCloseTo(usageCostsBox!.width, 0);
  await page.setViewportSize({ width: 1280, height: 720 });
  const createBillButton = billForm.getByRole("button", {
    name: "Add bill",
    exact: true,
  });
  await expect(createBillButton).toBeEnabled();
  await createBillButton.click();
  await expect(
    page.getByText("Complete the highlighted bill details", { exact: true }),
  ).toHaveCount(0);
  await expect(billForm.getByLabel("Total due")).toHaveAttribute("aria-invalid", "true");
  await expect(billForm.getByLabel("Fixed fees", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(billForm.getByLabel("Usage costs", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(billForm.getByRole("button", { name: "Service period" })).toHaveAttribute(
    "data-invalid",
    "true",
  );
  await expect(
    billForm.getByText("Choose the service start and end dates.", { exact: true }),
  ).toBeVisible();
  for (const name of ["Utility type", "Service period", "Paid by", "Split with"]) {
    await billForm.getByRole("button", { name, exact: true }).click();
    const selectionDialog = page.getByRole("dialog", { name, exact: true });
    await expect(selectionDialog).toBeVisible();
    await expect(selectionDialog.getByRole("button", { name: "Done", exact: true })).toBeVisible();
    await selectionDialog.getByRole("button", { name: "Back", exact: true }).click();
  }
  await billForm.getByRole("button", { name: "Utility type", exact: true }).click();
  const typeDialog = page.getByRole("dialog", { name: "Utility type", exact: true });
  await typeDialog.getByRole("radio", { name: "Electricity", exact: true }).click();
  await typeDialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(billForm.locator('[data-utility-type="electricity"]')).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "electricity.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("mock bill"),
  });
  expect(persistentUploadRequests).toBe(0);
  await expect(page.getByText(/tap to change/i)).toBeVisible();
  await page.getByRole("button", { name: "Autofill with AI" }).click();
  await expect(page.getByText("AI-filled", { exact: true })).toBeVisible();
  expect(persistentUploadRequests).toBe(0);
  await expect(billForm.getByRole("button", { name: "Service period" })).toContainText("Aug 26");
  await expect(billForm.getByLabel("Title")).toHaveValue("Electricity Aug 26 - Aug 26");
  await billForm.getByLabel("Title").fill("Edited electricity bill");
  await expect(page.getByText("AI-filled", { exact: true })).toBeVisible();
  await billForm.getByLabel("Total due").fill("101.00");
  await expect(page.getByRole("button", { name: "Autofill with AI", exact: true })).toBeVisible();
  await billForm.getByLabel("Total due").fill("100.00");
  await expect(page.getByText("AI-filled", { exact: true })).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });

  await page.goto(`${homeUrl}/account`);
  await expect(page).toHaveURL(`${homeUrl}/account`);
  await expect(page.getByRole("heading", { name: ownerName })).toBeVisible();
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
