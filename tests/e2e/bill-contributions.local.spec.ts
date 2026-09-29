import { expect, test } from "@playwright/test";

test("landlord bill shows reconciled member contributions on phone and desktop", async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const suffix = Date.now().toString().slice(-7);
  await page.goto("/?mode=create");
  await page.getByLabel("Group name").fill(`Bill QA ${suffix}`);
  await page.getByLabel("Your name").fill("Admin");
  await page.getByLabel("Group PIN").fill("654321");
  await page.getByLabel("Personal PIN").fill("123456");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 45_000 });
  const home = page.url();
  await page.goto(`${home}/settings`);
  const code = (
    await page
      .getByText(/^FROSKO-\d{4}$/)
      .first()
      .textContent()
  )?.trim();
  expect(code).toMatch(/^FROSKO-\d{4}$/);

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await secondPage.goto("/?mode=join");
  await secondPage.getByLabel("Group code").fill(code!);
  await secondPage.getByLabel("Your name").fill("Schiavo");
  await secondPage.getByLabel("Group PIN").fill("654321");
  await secondPage.getByLabel("Personal PIN").fill("222222");
  await secondPage.getByRole("button", { name: "Join", exact: true }).click();
  await expect(secondPage).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 20_000 });
  await secondContext.close();

  await page.getByRole("switch", { name: "Landlord mode" }).click();
  await expect(page.getByText("Group settings saved.")).toBeVisible();
  await page.goto(`${home}/add/bill`);
  await page.getByRole("button", { name: "Service period" }).click();
  const period = page.getByRole("dialog", { name: "Service period" });
  await period.getByRole("button", { name: "Service start date" }).click();
  await page
    .getByRole("dialog", { name: "Choose service start date" })
    .getByRole("button", { name: "Today", exact: true })
    .click();
  await period.getByRole("button", { name: "Service end date" }).click();
  await page
    .getByRole("dialog", { name: "Choose service end date" })
    .getByRole("button", { name: "Today", exact: true })
    .click();
  await period.getByRole("button", { name: "Done" }).click();
  await page.getByLabel("Title", { exact: true }).fill("QA electricity bill");
  await page.getByLabel("Total due").fill("100.00");
  await page.getByLabel("Fixed fees").fill("50.00");
  await page.getByLabel("Usage costs").fill("50.00");
  await page
    .locator("form[data-mobile-submit]")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(page).toHaveURL(home, { timeout: 20_000 });
  await page.getByRole("link", { name: /QA electricity bill/ }).click();
  await expect(page.getByText("To landlord").first()).toBeVisible();
  await expect(page.getByText("Original share").first()).toBeVisible();
  await expect(page.getByLabel("Fixed €25.00 plus usage €25.00")).toHaveCount(2);
  await expect(page.getByText("Part paid")).toHaveCount(0);

  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: testInfo.outputPath("bill-contributions-narrow-mobile.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("To landlord").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: testInfo.outputPath("bill-contributions-mobile.png") });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: testInfo.outputPath("bill-contributions-desktop.png") });

  await page.getByRole("button", { name: "Pay €50.00 to Landlord for this bill" }).click();
  const paymentDialog = page.getByRole("dialog", { name: "Confirm bill payment" });
  await expect(paymentDialog).toContainText("Pay €50.00 to Landlord for this bill?");
  await paymentDialog.getByRole("button", { name: "Confirm payment" }).click();
  await expect(page.getByText("paid to Landlord")).toBeVisible();
  await expect(page.getByLabel("Fixed €25.00 plus usage €25.00")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Void bill" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Edit bill after undoing payments" }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("paid-bill-locked-mobile.png") });
});
