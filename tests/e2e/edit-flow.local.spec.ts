import { expect, test } from "@playwright/test";

test("expense editing reuses the add form and only persists on save", async ({ page }) => {
  const origin = process.env.TEST_ORIGIN ?? "";
  const suffix = Date.now().toString().slice(-7);
  const originalTitle = `Original expense ${suffix}`;
  const updatedTitle = `Updated expense ${suffix}`;

  await page.goto(`${origin}/?mode=create`);
  await page.getByLabel("Household name").fill(`Edit flow ${suffix}`);
  await page.getByLabel("Owner name").fill(`Owner ${suffix}`);
  await page.getByLabel("House Join PIN").fill("654321");
  await page.getByLabel("Personal PIN").fill("123456");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 20_000 });
  const homeUrl = page.url();

  await page.goto(`${homeUrl}/add/expense`);
  await page.getByLabel("Description", { exact: true }).fill(originalTitle);
  await page.getByLabel("Amount", { exact: true }).fill("24.50");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page).toHaveURL(homeUrl);

  const expenseHref = await page
    .getByRole("link", { name: new RegExp(originalTitle) })
    .getAttribute("href");
  expect(expenseHref).toBeTruthy();
  await page.goto(expenseHref!);
  const detailUrl = page.url();
  const editUrl = await page
    .getByRole("link", { name: "Edit expense", exact: true })
    .getAttribute("href");
  expect(editUrl).toBeTruthy();
  await page.goto(editUrl!);
  await expect(page).toHaveURL(/\/edit$/);

  await expect(page.getByRole("heading", { name: "Edit expense", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Expense type" })).toHaveCount(0);
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(originalTitle);
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("24.50");

  await page.getByLabel("Description", { exact: true }).fill("Unsaved edit");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(detailUrl);
  await expect(page.getByRole("heading", { name: originalTitle, exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Edit expense", exact: true }).click();
  await page.getByLabel("Description", { exact: true }).fill(updatedTitle);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(detailUrl);
  await expect(page.getByRole("heading", { name: updatedTitle, exact: true })).toBeVisible();
});

test("utility bill editing reuses the add form and preserves cancelled changes", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const origin = process.env.TEST_ORIGIN ?? "";
  const suffix = Date.now().toString().slice(-7);

  await page.goto(`${origin}/?mode=create`);
  await page.getByLabel("Household name").fill(`Bill edit ${suffix}`);
  await page.getByLabel("Owner name").fill(`Owner ${suffix}`);
  await page.getByLabel("House Join PIN").fill("654321");
  await page.getByLabel("Personal PIN").fill("123456");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 20_000 });
  const homeUrl = page.url();

  await page.goto(`${homeUrl}/add/bill`);
  const billForm = page.locator("#bill-facts");
  await billForm.getByLabel("Total due").fill("20.00");
  await billForm.getByLabel("Fixed fees", { exact: true }).fill("5.00");
  await billForm.getByLabel("Usage costs", { exact: true }).fill("15.00");
  await billForm.getByRole("button", { name: "Service period" }).click();
  const serviceDialog = page.getByRole("dialog", { name: "Service period", exact: true });
  await serviceDialog.getByRole("button", { name: "Service start date" }).click();
  await page
    .getByRole("dialog", { name: "Choose service start date" })
    .getByRole("button", { name: "Today", exact: true })
    .click();
  await serviceDialog.getByRole("button", { name: "Service end date" }).click();
  await page
    .getByRole("dialog", { name: "Choose service end date" })
    .getByRole("button", { name: "Today", exact: true })
    .click();
  await serviceDialog.getByRole("button", { name: "Done", exact: true }).click();
  const billTitle = await billForm.getByLabel("Title").inputValue();
  await billForm.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page).toHaveURL(homeUrl);

  const billHref = await page
    .getByRole("link", { name: new RegExp(billTitle) })
    .getAttribute("href");
  expect(billHref).toBeTruthy();
  await page.goto(billHref!);
  await page.waitForLoadState("networkidle");
  const detailUrl = page.url();
  const billEditHref = await page
    .getByRole("link", { name: "Edit bill", exact: true })
    .getAttribute("href");
  expect(billEditHref).toBeTruthy();
  await page.goto(billEditHref!);
  await expect(page.getByRole("heading", { name: "Edit utility bill", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Expense type" })).toHaveCount(0);
  await expect(page.getByText("Choose a bill", { exact: true })).toBeVisible();
  await expect(billForm.getByLabel("Title")).toHaveValue(billTitle);
  await expect(billForm.getByLabel("Total due")).toHaveValue("20.00");

  await billForm.getByLabel("Notes (optional)").fill("Unsaved note");
  await billForm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(detailUrl);
  await page.goto(billEditHref!);
  await expect(billForm.getByLabel("Notes (optional)")).toHaveValue("");

  await billForm.getByLabel("Notes (optional)").fill("Saved note");
  await page.locator('input[type="file"]').setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByText("replacement.png", { exact: true })).toBeVisible();
  await billForm.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(detailUrl, { timeout: 20_000 });
  await expect(page.getByText("Bill document", { exact: true })).toBeVisible();
  await page.goto(billEditHref!);
  await expect(page.getByText("Current bill document", { exact: true })).toBeVisible();
  await expect(page.getByText("Private uploaded bill", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Bill document: Current bill document", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "View", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Replace", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove", exact: true })).toBeVisible();
  await expect(billForm.getByLabel("Notes (optional)")).toHaveValue("Saved note");
});

test("recurring rule editing uses the expense form", async ({ page }) => {
  test.setTimeout(60_000);
  const origin = process.env.TEST_ORIGIN ?? "";
  const suffix = Date.now().toString().slice(-7);
  const originalTitle = `Recurring ${suffix}`;
  const updatedTitle = `Updated recurring ${suffix}`;

  await page.goto(`${origin}/?mode=create`);
  await page.getByLabel("Household name").fill(`Recurring edit ${suffix}`);
  await page.getByLabel("Owner name").fill(`Owner ${suffix}`);
  await page.getByLabel("House Join PIN").fill("654321");
  await page.getByLabel("Personal PIN").fill("123456");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 20_000 });
  const homeUrl = page.url();

  await page.goto(`${homeUrl}/add/expense?recurring=1`);
  await page.getByLabel("Description", { exact: true }).fill(originalTitle);
  await page.getByLabel("Amount", { exact: true }).fill("18.00");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page).toHaveURL(homeUrl);

  await page.goto(`${homeUrl}/settings`);
  const recurringSection = page.locator("section", { hasText: "Recurring expenses" });
  await expect(recurringSection.getByText(new RegExp(`^${originalTitle}`))).toBeVisible();
  const editUrl = await recurringSection
    .getByRole("link", { name: "Edit", exact: true })
    .getAttribute("href");
  expect(editUrl).toBeTruthy();
  await page.goto(editUrl!);
  await expect(
    page.getByRole("heading", { name: "Edit recurring expense", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(originalTitle);
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("18.00");

  await page.getByLabel("Description", { exact: true }).fill(updatedTitle);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(`${homeUrl}/settings`);
  await expect(recurringSection.getByText(new RegExp(`^${updatedTitle}`))).toBeVisible();
});
