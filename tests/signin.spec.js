import { expect, test } from "@playwright/test";
import { mockFirebase } from "./fixtures/firebase";

test("email login opens chat and stays signed in after reload", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await mockFirebase(page);
  await page.goto("/signin");
  await page.getByRole("textbox", { name: "Email" }).fill("member@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole("button", { name: "New group" })).toBeVisible();
  expect(await page.evaluate(() => window.__firebaseTest.calls)).toEqual([
    { method: "email", email: "member@example.test" },
  ]);
  await page.reload();
  await expect(page.getByRole("button", { name: "New group" })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const database of ["pending", "denied", "write-denied"]) {
  test(`Google login opens chat when profile database is ${database}`, async ({ page }) => {
    await mockFirebase(page, { database, profileExists: false });
    await page.goto("/signin");
    // Filled email fields would trigger a second login if Google's button submitted the form.
    await page.getByRole("textbox", { name: "Email" }).fill("email@example.test");
    await page.getByLabel("Password", { exact: true }).fill("test-password");
    await page.getByRole("button", { name: "Sign in with Google", exact: true }).click();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByRole("button", { name: "New group" })).toBeVisible();
    expect(await page.evaluate(() => window.__firebaseTest.calls)).toEqual([
      { method: "google", email: undefined },
    ]);
    await expect(page.locator(".user-details strong")).toHaveText("Test member");
  });
}

test("Google login with empty email fields creates a missing profile", async ({ page }) => {
  await mockFirebase(page, { profileExists: false });
  await page.goto("/signin");
  await page.getByRole("button", { name: "Sign in with Google", exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect.poll(() => page.evaluate(() => window.__firebaseTest.profileWrites)).toEqual([
    { userName: "Test member", email: "member@example.test" },
  ]);
});

test("restored session leaves the login page automatically", async ({ page }) => {
  await mockFirebase(page, { user: { uid: "test-user", email: "member@example.test" } });
  await page.goto("/signin");
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole("button", { name: "New group" })).toBeVisible();
});

test("invalid email credentials show an error and allow a successful retry", async ({ page }) => {
  await mockFirebase(page, { authError: "auth/invalid-credential" });
  await page.goto("/signin");
  await page.getByRole("textbox", { name: "Email" }).fill("member@example.test");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("The email or password is incorrect.");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeEnabled();
  await page.evaluate(() => { window.__firebaseTest.authError = null; });
  await page.getByLabel("Password", { exact: true }).fill("correct-password");
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/chat$/);
});

test("blocked Google popup shows an actionable error without email login", async ({ page }) => {
  await mockFirebase(page, { authError: "auth/popup-blocked" });
  await page.goto("/signin");
  await page.getByRole("button", { name: "Sign in with Google", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Allow pop-ups");
  await expect(page).toHaveURL(/\/signin$/);
  expect(await page.evaluate(() => window.__firebaseTest.calls.length)).toBe(1);
  await expect(page.getByRole("button", { name: "Sign in with Google", exact: true })).toBeEnabled();
});

test("signed-out visitors return to sign-in without exposing chat", async ({ page }) => {
  await mockFirebase(page);
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("button", { name: "New group" })).toHaveCount(0);
});
