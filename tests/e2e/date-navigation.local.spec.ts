import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

test("bill and member dates can jump by month and year on a narrow screen", async ({ page }) => {
  const targetYear = new Date().getUTCFullYear() - 2;
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(`${process.env.FROSKOLIN_TEST_URL ?? ""}/?mode=create`);
  await page.getByLabel("Group name").fill(`Date navigation ${Date.now()}`);
  await page.getByLabel("Your name").fill("Date tester");
  await page.getByLabel("Group PIN").fill("654321");
  await page.getByLabel("Personal PIN").fill("123456");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 20_000 });
  const homeUrl = page.url();

  await page.goto(`${homeUrl}/add/bill`);
  await page.getByRole("button", { name: "Service period" }).click();
  await page.getByRole("button", { name: "Service start date" }).click();
  const billDate = page.getByRole("dialog", { name: "Choose service start date" });
  await billDate.getByRole("button", { name: "Choose year" }).click();
  await expect(billDate.getByRole("listbox", { name: "Choose year" })).toBeVisible();
  await billDate.screenshot({ path: test.info().outputPath("bill-year-picker-320.png") });
  await billDate.getByRole("option", { name: String(targetYear) }).click();
  await billDate.getByRole("button", { name: "Choose month" }).click();
  await billDate.getByRole("option", { name: "Jan" }).click();
  await expect(billDate.getByRole("button", { name: "Choose year" })).toContainText(
    String(targetYear),
  );

  await page.goto(`${homeUrl}/settings`);
  await page.getByRole("button", { name: "Edit billing dates for Date tester" }).click();
  await page.getByRole("button", { name: "Out date" }).click();
  const outDate = page.getByRole("dialog", { name: "Choose out date" });
  await outDate.getByRole("button", { name: "Choose month" }).click();
  await expect(outDate.getByRole("listbox", { name: "Choose month" })).toBeVisible();
  const november = await outDate.getByRole("option", { name: "Nov" }).boundingBox();
  const december = await outDate.getByRole("option", { name: "Dec" }).boundingBox();
  expect(december!.x - november!.x).toBeGreaterThan(60);
  await outDate.screenshot({ path: test.info().outputPath("member-month-picker-320.png") });

  await page.goto(`${homeUrl}/calendar`);
  const calendar = page.getByRole("region", { name: "Away period calendar" });
  const currentMonth = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(new Date());
  await expect(calendar.getByRole("button", { name: "Choose month" })).toContainText(currentMonth);
});
