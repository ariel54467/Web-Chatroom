import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures/supabase";

const device = { p_endpoint: "https://push.example.test/device-1", p_p256dh: "test-p256dh", p_auth: "test-auth" };

test("the bell turns notifications on and off for this device", async ({ page }) => {
  const api = await mockSupabase(page, { signedIn: true, push: {} });
  await page.goto("/chat");
  await page.getByRole("button", { name: "Turn on notifications" }).click();
  await expect(page.getByRole("button", { name: "Turn off notifications" })).toBeVisible();
  expect(api.rpcCalls("save_push_subscription")).toEqual([device]);
  expect(await page.evaluate(() => window.__push.subscribeOptions)).toEqual({ userVisibleOnly: true, keyBytes: 65 });
  await page.getByRole("button", { name: "Turn off notifications" }).click();
  await expect(page.getByRole("button", { name: "Turn on notifications" })).toBeVisible();
  expect(api.rpcCalls("delete_push_subscription")).toEqual([{ p_endpoint: device.p_endpoint }]);
  expect(await page.evaluate(() => window.__push.subscription)).toBeNull();
});

test("blocked notifications explain how to allow them", async ({ page }) => {
  const api = await mockSupabase(page, { signedIn: true, push: { answer: "denied" } });
  await page.goto("/chat");
  await page.getByRole("button", { name: "Turn on notifications" }).click();
  await expect(page.getByRole("alert")).toContainText("Notifications are blocked for this site");
  await expect(page.getByRole("button", { name: "Turn on notifications" })).toBeEnabled();
  expect(api.rpcCalls("save_push_subscription")).toEqual([]);
});

test("a returning device stays registered, and signing out turns it off", async ({ page }) => {
  const api = await mockSupabase(page, { signedIn: true, push: { permission: "granted", subscribed: true } });
  await page.goto("/chat");
  await expect(page.getByRole("button", { name: "Turn off notifications" })).toBeVisible();
  expect(api.rpcCalls("save_push_subscription")).toEqual([device]);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/signin$/);
  expect(api.rpcCalls("delete_push_subscription")).toEqual([{ p_endpoint: device.p_endpoint }]);
  expect(await page.evaluate(() => window.__push.subscription)).toBeNull();
});

test("the tab title shows the unread count", async ({ page }) => {
  await mockSupabase(page, { signedIn: true, rooms: [{
    id: "00000000-0000-4000-8000-000000000020", kind: "group", name: "Study group", avatar_path: null,
    last_message: "See you", updated_at: "2026-01-01T10:00:00Z", unread: 3, member_count: 3,
  }] });
  await page.goto("/chat");
  await expect(page).toHaveTitle("(3) Chatterly");
});
