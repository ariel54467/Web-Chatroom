import { expect, test } from "@playwright/test";
import { directChat, mockSupabase, profile, room } from "./fixtures/supabase";

test("a new account chooses a username before chatting", async ({ page }) => {
  const api = await mockSupabase(page, { signedIn: true, profile: { ...profile, username: null } });
  await page.goto("/chat");
  await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chats", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "New group" })).toBeDisabled();
  await page.getByLabel("Username").fill("New_Member");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("heading", { name: "Chats" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New group" })).toBeEnabled();
  expect(api.rpcCalls("save_profile")).toEqual([{ p_username: "new_member", p_display_name: "Test member", p_avatar_path: null }]);
});

test("Enter sends a message that appears in the conversation", async ({ page }) => {
  const api = await mockSupabase(page, { signedIn: true, rooms: [directChat] });
  await page.goto("/chat");
  await page.getByRole("button", { name: /Test friend/ }).click();
  await expect(page).toHaveURL(new RegExp(`chat=${room}$`));
  await expect(page.getByRole("heading", { name: "No messages yet" })).toBeVisible();
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("Hello there");
  await box.press("Enter");
  await expect(page.getByLabel("Messages", { exact: true }).getByText("Hello there")).toBeVisible();
  await expect(box).toHaveValue("");
  expect(api.rpcCalls("send_message")).toEqual([{
    p_id: expect.any(String), p_room: room, p_body: "Hello there", p_kind: "text",
    p_storage_path: null, p_file_name: null,
  }]);
  await expect.poll(() => api.rpcCalls("mark_read").length).toBeGreaterThan(0);
  await expect.poll(() => api.pushCalls()).toEqual([api.rpcCalls("send_message")[0].p_id]);
  expect(api.unexpected).toEqual([]);
});

test("the emoji button inserts an emoji where the cursor is", async ({ page }) => {
  await mockSupabase(page, { signedIn: true, rooms: [directChat] });
  await page.goto(`/chat?chat=${room}`);
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("Nice work");
  await box.press("Home");
  for (let i = 0; i < 4; i++) await box.press("ArrowRight");
  await page.getByRole("button", { name: "Add emoji" }).click();
  const picker = page.getByRole("dialog", { name: "Emoji" });
  await picker.getByRole("textbox", { name: "Type to search for an emoji" }).fill("thumbs up");
  await picker.getByRole("button", { name: "thumbs up", exact: true }).click();
  await expect(box).toHaveValue("Nice👍 work");
  await expect(box).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add emoji" })).toBeFocused();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the emoji picker fits the screen and keeps the keyboard closed", async ({ page }) => {
    await mockSupabase(page, { signedIn: true, rooms: [directChat] });
    await page.goto(`/chat?chat=${room}`);
    await page.getByRole("button", { name: "Add emoji" }).tap();
    const picker = page.getByRole("dialog", { name: "Emoji" });
    const search = picker.getByRole("textbox", { name: "Type to search for an emoji" });
    await expect(search).toBeVisible();
    await expect(search).not.toBeFocused();
    const bounds = await picker.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    await picker.getByRole("button", { name: "grinning face", exact: true }).tap();
    await picker.getByRole("button", { name: "grinning face", exact: true }).tap();
    const box = page.getByRole("textbox", { name: "Message" });
    await expect(box).toHaveValue("😀😀");
    await expect(box).not.toBeFocused();
    // The picker covers the middle of the chat on a phone, so tap near the top.
    await page.getByLabel("Messages", { exact: true }).tap({ position: { x: 20, y: 20 } });
    await expect(picker).toHaveCount(0);
  });
});

test("a failed send can be retried without duplicating the message", async ({ page }) => {
  const api = await mockSupabase(page, { signedIn: true, rooms: [directChat], failSends: 1 });
  await page.goto(`/chat?chat=${room}`);
  await page.getByRole("textbox", { name: "Message" }).fill("Are you there?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert")).toHaveText("Temporary database failure.");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByLabel("Messages", { exact: true }).getByText("Are you there?")).toHaveCount(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
  const sends = api.rpcCalls("send_message");
  expect(sends).toHaveLength(2);
  expect(sends[1].p_id).toBe(sends[0].p_id);
});
