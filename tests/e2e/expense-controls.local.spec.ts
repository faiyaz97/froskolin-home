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
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/h\/[0-9a-f-]+$/, { timeout: 20000 });
  const home = page.url();
  await page.goto(`${home}/add/expense`);
  await expect(page).toHaveURL(`${home}/add/expense`);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const expenseForm = page.locator("form[data-mobile-submit]");
  await expect(async () => {
    await page.getByRole("button", { name: "Currency", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Currency", exact: true })).toBeVisible();
  }).toPass({ timeout: 15000 });
  await page
    .getByRole("dialog", { name: "Currency", exact: true })
    .getByRole("button", { name: "Back", exact: true })
    .click();
  if (testInfo.project.use.viewport!.width < 768) {
    await page.getByRole("button", { name: "Add expense", exact: true }).click();
  } else {
    await expenseForm.getByRole("button", { name: "Add", exact: true }).click();
  }
  await expect(expenseForm.getByLabel("Description", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(expenseForm.getByLabel("Amount", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(expenseForm.getByText("Add a description.", { exact: true })).toBeVisible();
  await expect(
    expenseForm.getByText("Enter an amount greater than zero.", { exact: true }),
  ).toBeVisible();
  await expenseForm.getByLabel("Description", { exact: true }).fill("Expense UI test");
  await expenseForm.getByLabel("Amount", { exact: true }).fill("100.00");

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
  await page.screenshot({ path: testInfo.outputPath("expense-desktop.png") });

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
  await expect(splitDialog.getByText("All accounted for", { exact: true })).toHaveCount(0);
  await splitDialog.getByLabel(`${owner} amount`, { exact: true }).fill("0");
  await expect(splitDialog.getByText("Shares must total €100.00.", { exact: true })).toBeVisible();
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
    if (testInfo.project.use.viewport!.width < 768) {
      await page.getByRole("button", { name: "Add expense", exact: true }).click();
    } else {
      await page
        .locator("form[data-mobile-submit]")
        .getByRole("button", { name: "Add", exact: true })
        .click();
    }
    await expect(page).toHaveURL(home);
    await page.goto(`${home}/settings`);
    await expect(page.getByText(new RegExp(`^${frequency} ·`, "i"))).toBeVisible();
    await page.getByRole("button", { name: "Run now", exact: true }).click();
    await expect(page.getByText(/1 due recurring expense generated/)).toBeVisible();
  }

  await page.getByRole("switch", { name: "Landlord mode" }).click();
  await expect(page.getByText("Group settings saved.")).toBeVisible();
  await page.goto(home);
  await page.setViewportSize({ width: 320, height: 360 });
  const summary = page.locator(".home-summary-motion");
  const stickyFrame = page.locator(".home-summary-sticky-frame");
  const bottomMascot = page.locator('img[src*="froskolin-sleeping"]');
  const expandedSummary = await summary.boundingBox();
  const expandedFrame = await stickyFrame.boundingBox();
  await page.screenshot({ path: testInfo.outputPath("home-summary-expanded-320.png") });

  await page.mouse.move(160, 180);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect
    .poll(async () =>
      Number(
        await summary.evaluate((element) =>
          element.style.getPropertyValue("--home-detail-opacity"),
        ),
      ),
    )
    .toBeLessThan(0.8);
  const midTransitionOpacity = Number(
    await summary.evaluate((element) => element.style.getPropertyValue("--home-detail-opacity")),
  );
  expect(midTransitionOpacity).toBeGreaterThan(0.2);
  await page.screenshot({ path: testInfo.outputPath("home-summary-transition-320.png") });

  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
  await expect(summary).toHaveAttribute("data-collapsed", "true");
  const collapsedSummary = await summary.boundingBox();
  const collapsedFrame = await stickyFrame.boundingBox();
  expect(collapsedSummary!.height).toBeLessThan(expandedSummary!.height);
  expect(collapsedSummary!.y).toBeCloseTo(0, 0);
  expect(collapsedFrame!.height).toBeCloseTo(expandedFrame!.height, 0);
  const balanceDivider = await summary.locator(".home-summary-divider").boundingBox();
  expect(balanceDivider!.width).toBeCloseTo(1, 0);
  expect(balanceDivider!.height).toBeCloseTo(28, 0);
  await expect(bottomMascot).toHaveCSS("opacity", "1");
  const mascotBox = await bottomMascot.boundingBox();
  const mobileNavigationBox = await page.getByRole("navigation", { name: "Primary" }).boundingBox();
  expect(Math.abs(mascotBox!.y + mascotBox!.height - mobileNavigationBox!.y)).toBeLessThanOrEqual(
    8,
  );
  await page.screenshot({ path: testInfo.outputPath("home-summary-collapsed-320.png") });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => window.scrollTo(0, 1));
  await expect(summary).toHaveAttribute("data-collapsed", "false");
  await expect
    .poll(async () =>
      Number(
        await summary.evaluate((element) =>
          element.style.getPropertyValue("--home-detail-opacity"),
        ),
      ),
    )
    .toBeGreaterThan(0.99);
  await page.evaluate(() => window.scrollTo(0, 48));
  await expect
    .poll(async () =>
      Number(
        await summary.evaluate((element) =>
          element.style.getPropertyValue("--home-detail-opacity"),
        ),
      ),
    )
    .toBeLessThan(0.8);
  const reducedMotionMidOpacity = Number(
    await summary.evaluate((element) => element.style.getPropertyValue("--home-detail-opacity")),
  );
  expect(reducedMotionMidOpacity).toBeGreaterThan(0.2);
  expect(reducedMotionMidOpacity).toBeLessThan(0.8);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewportSize({ width: 1024, height: 500 });
  await expect(summary).toHaveAttribute("data-collapsed", "false");
  const desktopExpandedSummary = await summary.boundingBox();
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
  await expect(summary).toHaveAttribute("data-collapsed", "false");
  const desktopSummary = await summary.boundingBox();
  expect(desktopSummary!.height).toBeCloseTo(desktopExpandedSummary!.height, 0);
  await expect(bottomMascot).toHaveCSS("opacity", "1");
  const desktopMascotBox = await bottomMascot.boundingBox();
  const desktopNavigationBox = await page
    .getByRole("navigation", { name: "Primary" })
    .boundingBox();
  expect(
    Math.abs(desktopMascotBox!.y + desktopMascotBox!.height - desktopNavigationBox!.y),
  ).toBeLessThanOrEqual(10);
  await page.screenshot({ path: testInfo.outputPath("home-summary-desktop.png") });
  expect(pageErrors).toEqual([]);
});
