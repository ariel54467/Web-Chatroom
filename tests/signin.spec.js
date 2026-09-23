import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures/supabase";

const newGroup = page => page.getByRole("button", { name: "New group" });

test("email sign-in opens chat and stays signed in after reload", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const api = await mockSupabase(page);
  await page.goto("/signin");
  await page.getByLabel("Email").fill("member@example.test");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(newGroup(page)).toBeEnabled();
  await page.reload();
  await expect(newGroup(page)).toBeEnabled();
  expect(api.authCalls()).toEqual([{ auth: "password", email: "member@example.test" }]);
  expect(api.unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("invalid email credentials show an error and allow a successful retry", async ({ page }) => {
  const api = await mockSupabase(page, { authError: "invalid_credentials" });
  await page.goto("/signin");
  await page.getByLabel("Email").fill("member@example.test");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid login credentials");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  api.authError = null;
  await page.getByLabel("Password").fill("correct-password");
  await page.getByLabel("Password").press("Enter");
  await expect(page).toHaveURL(/\/chat$/);
  expect(api.authCalls()).toHaveLength(2);
});

test("Google sign-in completes the PKCE redirect and opens chat", async ({ page, baseURL }) => {
  const api = await mockSupabase(page);
  await page.goto("/signin");
  // Filled email fields would trigger a second login if Google's button submitted the form.
  await page.getByLabel("Email").fill("email@example.test");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(newGroup(page)).toBeEnabled();
  expect(api.authCalls()).toEqual([
    { auth: "authorize", provider: "google", redirectTo: `${baseURL}/chat`, pkce: true },
    { auth: "pkce", code: "test-code", verifier: true },
  ]);
});

test("Google sign-in still finishes when Supabase returns to the site root", async ({ page }) => {
  const api = await mockSupabase(page, { oauthLanding: "/" });
  await page.goto("/signin");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(newGroup(page)).toBeEnabled();
  expect(api.authCalls().map(call => call.auth)).toEqual(["authorize", "pkce"]);
});

test("a failed Google sign-in explains what went wrong", async ({ page }) => {
  await mockSupabase(page, { oauthError: "Unable to exchange external code" });
  await page.goto("/signin");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("alert")).toHaveText("Unable to exchange external code");
});

test("sign-up asks new members to confirm their email", async ({ page }) => {
  const api = await mockSupabase(page);
  await page.goto("/signup");
  await page.getByLabel("Display name").fill("New member");
  await page.getByLabel("Email").fill("new@example.test");
  await page.getByLabel("Password").fill("long-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toHaveText("Check your email for the confirmation link.");
  await expect(page).toHaveURL(/\/signup$/);
  expect(api.authCalls()).toEqual([{ auth: "signup", email: "new@example.test", displayName: "New member" }]);
});

test("restored session leaves the sign-in page automatically", async ({ page }) => {
  const api = await mockSupabase(page, { signedIn: true });
  await page.goto("/signin");
  await expect(page).toHaveURL(/\/chat$/);
  await expect(newGroup(page)).toBeEnabled();
  expect(api.authCalls()).toEqual([]);
});

test("signing out returns to sign-in", async ({ page }) => {
  const api = await mockSupabase(page, { signedIn: true });
  await page.goto("/chat");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await expect(newGroup(page)).toHaveCount(0);
  expect(api.authCalls()).toEqual([{ auth: "logout" }]);
});

test("signed-out visitors return to sign-in without exposing chat", async ({ page }) => {
  await mockSupabase(page);
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(newGroup(page)).toHaveCount(0);
});
