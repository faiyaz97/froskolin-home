import { expect, test } from "@playwright/test";

test("expense controls fit small screens and persist weekly/yearly schedules", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const suffix = Date.now();
  const owner = `Alex ${suffix}`;
  await page.goto("/?mode=create");
  // Exercise a client-side control before submitting: dev HMR never becomes network-idle.
  await expect(async () => {
    await page.getByRole("button", { name: "Household currency", exact: true }).click();
    await expect(page.getByRole("listbox", { name: "Household currency" })).toBeVisible();
  }).toPass({ timeout: 15000 });
  await page.getByRole("option", { name: "EUR · Euro", exact: true }).click();
  await page.getByLabel("Household name").fill(`Expense UI test ${suffix}`);
  await page.getByLabel("Owner name").fill(owner);
  await page.getByLabel("House Join PIN").fill("654321");
  await page.getByLabel("Personal PIN").fill("123456");
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 20000 });
  const home = page.url();
  await page.goto(`${home}/add/expense`);
  await expect(page).toHaveURL(`${home}/add/expense`);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const width of [320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 740 });
    for (const name of ["Currency", "Split method", "Paid by"]) {
      await page.getByRole("button", { name, exact: true }).click();
      const dialogName =
        name === "Split method" ? "Split expense" : name === "Paid by" ? "Paid by" : "Currency";
      const dialog = page.getByRole("dialog", { name: dialogName, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Back", exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Done", exact: true })).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(7);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width - 7);
      expect(box!.y).toBeGreaterThanOrEqual(7);
      expect(box!.y + box!.height).toBeLessThanOrEqual(733);
      if (name === "Paid by") {
        await expect(dialog.getByRole("radio", { name: owner, exact: true })).toBeVisible();
        await expect(dialog.getByRole("radio", { name: /You/ })).toHaveCount(0);
      }
      if (name === "Split method")
        await dialog.getByRole("button", { name: "Amounts", exact: true }).click();
      await dialog.getByRole("button", { name: "Back", exact: true }).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.getByRole("button", { name: "Split method", exact: true }).click();
    const splitDialog = page.getByRole("dialog", { name: "Split expense", exact: true });
    await splitDialog.getByRole("button", { name: "Equally", exact: true }).click();
    await splitDialog.getByRole("button", { name: "Done", exact: true }).click();
  }

  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole("button", { name: /Split with/ }).click();
  await expect(page.getByRole("checkbox", { name: owner })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Everyone", exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("split-with-320.png") });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Split method", exact: true }).click();
  const splitDialog = page.getByRole("dialog", { name: "Split expense", exact: true });
  await page.screenshot({ path: testInfo.outputPath("split-equal-320.png") });
  await splitDialog.getByRole("button", { name: "Amounts", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("split-amounts-320.png") });
  await splitDialog.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByLabel("Description", { exact: true }).focus();
  expect(
    await page
      .getByLabel("Description", { exact: true })
      .evaluate((node) => getComputedStyle(node).outlineStyle),
  ).toBe("none");
  const toolbar = await page.getByRole("group", { name: "Expense tools" }).boundingBox();
  expect(toolbar!.y + toolbar!.height).toBeCloseTo(640, 0);
  await page.screenshot({ path: testInfo.outputPath("expense-320.png") });
  const attachmentBefore = await page.getByRole("button", { name: "Add attachment" }).boundingBox();
  await page.getByLabel("Choose attachment").setInputFiles({
    name: "receipt.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("receipt"),
  });
  const attachmentAfter = await page.getByRole("button", { name: /Attachment/ }).boundingBox();
  expect(attachmentAfter!.width).toBeCloseTo(attachmentBefore!.width, 0);
  await page.screenshot({ path: testInfo.outputPath("attachment-added-320.png") });

  await page.getByRole("button", { name: /^Date / }).click();
  const dialog = page.getByRole("dialog", { name: "Date", exact: true });
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox!.x + dialogBox!.width / 2).toBeCloseTo(160, 0);
  expect(dialogBox!.y + dialogBox!.height / 2).toBeCloseTo(320, 0);
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Choose month", exact: true }).click();
  await expect(dialog.getByText(/· Months$/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("calendar-months-320.png") });
  await dialog.getByRole("option", { selected: true }).click();
  await dialog.getByRole("button", { name: "Choose year", exact: true }).click();
  await expect(dialog.getByText(/\d{4}–\d{4}/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("calendar-years-320.png") });
  await dialog.getByRole("option", { selected: true }).click();
  await dialog.getByRole("button", { name: "Weekly", exact: true }).click();
  await expect(dialog.getByText("Starts", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Ends", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: /^Ends/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(dialog.getByRole("grid")).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "Ends Never", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("calendar-320.png") });
  await dialog.getByRole("button", { name: "Done" }).click();

  for (const frequency of ["Weekly", "Yearly"]) {
    if (frequency === "Yearly") {
      await page.getByRole("button", { name: "Go back", exact: true }).click();
      await expect(page).toHaveURL(home);
      await page.goto(`${home}/add/expense`);
      await page.getByRole("button", { name: /^Date / }).click();
      await page.getByRole("button", { name: "Yearly", exact: true }).click();
      await page.getByRole("button", { name: "Done" }).click();
    }
    await page.getByLabel("Description", { exact: true }).fill(`${frequency} UI test`);
    await page.getByLabel("Amount", { exact: true }).fill("12.34");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(home);
    await page.getByRole("link", { name: "Household settings", exact: true }).click();
    await expect(page.getByText(new RegExp(`^${frequency}$`, "i"))).toBeVisible();
    await page.getByRole("button", { name: "Generate due", exact: true }).click();
    await expect(page.getByText(/1 due recurring expense generated/)).toBeVisible();
  }
  expect(pageErrors).toEqual([]);
});
