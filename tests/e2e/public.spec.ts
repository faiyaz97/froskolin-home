import { expect, test } from "@playwright/test";

test("root opens the group entry form without marketing content or overflow", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Create group" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Group access" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create", exact: true })).toHaveAttribute(
    "href",
    "/?mode=create",
  );
  await expect(page.getByRole("link", { name: "Join", exact: true })).toHaveAttribute(
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

test("a remembered login does not block creating or joining a group", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "froskolin.remembered-device.v1",
      JSON.stringify({ houseCode: "FROSKO-6114", memberName: "Andrea" }),
    );
  });

  await page.goto("/?mode=create");
  await expect(page).toHaveURL(/\?mode=create$/);
  await expect(page.getByRole("heading", { name: "Create group" })).toBeVisible();

  await page.getByRole("link", { name: "Join", exact: true }).click();
  await expect(page).toHaveURL(/\?mode=join$/);
  await expect(page.getByRole("heading", { name: "Join group" })).toBeVisible();
});

test("login form has accessible group and personal credentials", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Group code").fill("FROSKO-2847");
  await page.getByLabel("Your name").fill("Andrea");
  const pin = page.getByLabel("Personal PIN");
  await pin.fill("12");
  expect(await pin.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  await pin.fill("482615");
  expect(await pin.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(true);
});

test("join form keeps group access before personal details", async ({ page }) => {
  await page.goto("/?mode=join");

  const groupCode = page.getByLabel("Group code");
  const groupPin = page.getByLabel("Group PIN");
  const name = page.getByLabel("Your name");
  const personalPin = page.getByLabel("Personal PIN");

  await expect(groupCode).toBeVisible();
  await expect(groupPin).toBeVisible();
  await expect(name).toBeVisible();
  await expect(personalPin).toBeVisible();
  const groupAccessComesFirst = await groupPin.evaluate(
    (groupPinElement, nameElement) =>
      Boolean(
        groupPinElement.compareDocumentPosition(nameElement) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    await name.elementHandle(),
  );
  expect(groupAccessComesFirst).toBe(true);
});

test("create-group form is minimal and does not expose currency", async ({ page }) => {
  await page.goto("/create-home");
  await expect(page).toHaveURL(/\/?mode=create$/);
  await expect(page.getByRole("heading", { name: "Create group" })).toBeVisible();
  await expect(page.getByLabel("Group name")).toBeVisible();
  await expect(page.getByLabel("Group PIN")).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.locator('[name="defaultCurrency"]')).toHaveCount(0);
});

test("create-group submission is hydrated on the 127.0.0.1 development origin", async ({
  page,
}) => {
  const createGroupUrl = "http://127.0.0.1:3000/?mode=create";
  await page.route(createGroupUrl, async (route) => {
    if (route.request().method() === "POST") {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto(createGroupUrl);
  await page.getByLabel("Group name").fill("Froskolin test group");
  await page.getByLabel("Your name").fill("Test member");
  await page.getByLabel("Group PIN").fill("654321");
  await page.getByLabel("Personal PIN").fill("482615");

  const submission = page.waitForRequest((request) => new URL(request.url()).pathname === "/");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  expect((await submission).method()).toBe("POST");
});

test("authentication forms fit inside the viewport without horizontal scrolling", async ({
  page,
}) => {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);

    for (const path of ["/?mode=create", "/?mode=join", "/login"]) {
      await page.goto(path);
      const dimensions = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
      }));

      expect(dimensions.pageWidth, `${path} should fit horizontally`).toBeLessThanOrEqual(
        dimensions.viewportWidth,
      );
    }
  }
});
