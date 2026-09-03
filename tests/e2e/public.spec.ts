import { expect, test } from "@playwright/test";

test("root opens the household entry form without marketing content or overflow", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Create household" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create household" })).toHaveAttribute(
    "href",
    "/?mode=create",
  );
  await expect(page.getByRole("link", { name: "Join roommates" })).toHaveAttribute(
    "href",
    "/?mode=join",
  );
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  await expect(page.getByText("Bills, without the bad vibes.")).toHaveCount(0);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
  expect(browserErrors).toEqual([]);
});

test("login form has accessible labels for the House Code and personal PIN", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Household details" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Your details" })).toBeVisible();

  await page.getByLabel("House Code").fill("FROSKO-2847");
  await page.getByLabel("Member name").fill("Andrea");
  const pin = page.getByLabel("Personal PIN");
  await pin.fill("12");
  expect(await pin.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  await pin.fill("482615");
  expect(await pin.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(true);
});

test("join form groups household access before personal details", async ({ page }) => {
  await page.goto("/?mode=join");

  const household = page.getByRole("group", { name: "Household details" });
  const person = page.getByRole("group", { name: "Your details" });

  await expect(household.getByLabel("House Code")).toBeVisible();
  await expect(household.getByLabel("House Join PIN")).toBeVisible();
  await expect(person.getByLabel("Your name")).toBeVisible();
  await expect(person.getByLabel("Personal PIN")).toBeVisible();

  const householdComesFirst = await household.evaluate(
    (householdElement, personElement) =>
      Boolean(
        householdElement.compareDocumentPosition(personElement) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    await person.elementHandle(),
  );
  expect(householdComesFirst).toBe(true);
});

test("create-home form includes the small-household defaults", async ({ page }) => {
  await page.goto("/create-home");
  await expect(page).toHaveURL(/\/?mode=create$/);
  await expect(page.getByRole("heading", { name: "Create household" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Household details" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Owner details" })).toBeVisible();
  await expect(page.locator('input[name="defaultCurrency"]')).toHaveValue("EUR");
});

test("create-home submission is hydrated on the 127.0.0.1 development origin", async ({ page }) => {
  const createHomeUrl = "http://127.0.0.1:3000/?mode=create";
  await page.route(createHomeUrl, async (route) => {
    if (route.request().method() === "POST") {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto(createHomeUrl);
  await page.getByLabel("Household name").fill("Froskolin test home");
  await page.getByLabel("Owner name").fill("Test roommate");
  await page.getByLabel("House Join PIN").fill("654321");
  await page.getByLabel("Personal PIN").fill("482615");

  const submission = page.waitForRequest((request) => new URL(request.url()).pathname === "/");
  await page.getByRole("button", { name: "Create household" }).click();

  expect((await submission).method()).toBe("POST");
});

test("authentication forms fit inside the viewport without page scrolling", async ({ page }) => {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);

    for (const path of ["/?mode=create", "/?mode=join", "/login", "/change-pin"]) {
      await page.goto(path);
      const dimensions = await page.evaluate(() => ({
        viewportHeight: window.innerHeight,
        pageHeight: document.documentElement.scrollHeight,
        viewportWidth: document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
      }));

      expect(dimensions.pageHeight, `${path} should fit vertically`).toBeLessThanOrEqual(
        dimensions.viewportHeight,
      );
      expect(dimensions.pageWidth, `${path} should fit horizontally`).toBeLessThanOrEqual(
        dimensions.viewportWidth,
      );
    }
  }
});
