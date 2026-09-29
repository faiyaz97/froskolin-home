import { expect, test } from "@playwright/test";

test("balance tree confirms a payment and Home keeps one timeline", async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const suffix = Date.now().toString().slice(-7);
  const owner = `Balance owner ${suffix}`;
  const member = `Balance member ${suffix}`;
  await page.goto("/?mode=create");
  await page.getByLabel("Group name").fill(`Balance QA ${suffix}`);
  await page.getByLabel("Your name").fill(owner);
  await page.getByLabel("Group PIN").fill("654321");
  await page.getByLabel("Personal PIN").fill("123456");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 20_000 });
  const home = page.url();
  await page.goto(`${home}/settings`);
  const code = (
    await page
      .getByText(/^FROSKO-\d{4}$/)
      .first()
      .textContent()
  )?.trim();
  expect(code).toMatch(/^FROSKO-\d{4}$/);

  const secondContext = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const secondPage = await secondContext.newPage();
  await secondPage.goto("/?mode=join");
  await secondPage.getByLabel("Group code").fill(code!);
  await secondPage.getByLabel("Your name").fill(member);
  await secondPage.getByLabel("Group PIN").fill("654321");
  await secondPage.getByLabel("Personal PIN").fill("222222");
  await secondPage.getByRole("button", { name: "Join", exact: true }).click();
  await expect(secondPage).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 20_000 });

  await page.goto(`${home}/add/expense`);
  await page.getByLabel("Description", { exact: true }).fill("Balance QA breakfast");
  await page.getByLabel("Amount", { exact: true }).fill("30.00");
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.getByRole("button", { name: "Add expense", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Add", exact: true }).click();
  }
  await expect(page).toHaveURL(home, { timeout: 20_000 });
  await expect(page.getByRole("link", { name: /Balance QA breakfast/ })).toBeVisible();

  await secondPage.goto(`${home}/balances`);
  await expect(secondPage.getByRole("button", { name: "Settle up" })).toBeVisible();
  await expect(secondPage.getByText(owner, { exact: true }).first()).toBeVisible();
  await secondPage.screenshot({ path: testInfo.outputPath("balance-tree-mobile.png") });
  expect(await secondPage.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await secondPage.getByRole("button", { name: "Settle up" }).click();
  const dialog = secondPage.getByRole("dialog", { name: "Confirm payment" });
  await expect(dialog).toContainText("€15.00");
  await dialog.getByRole("button", { name: "Confirm payment" }).click();
  await expect(dialog).toHaveCount(0, { timeout: 20_000 });
  await expect(secondPage.getByRole("button", { name: "Settle up" })).toHaveCount(0);
  await secondPage.goto(home);
  await expect(secondPage.getByText("Balance QA breakfast")).toBeVisible();
  await expect(secondPage.getByText("Payment", { exact: true })).toBeVisible();
  await secondPage.screenshot({ path: testInfo.outputPath("home-timeline-mobile.png") });
  expect(await secondPage.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await secondContext.close();
});
