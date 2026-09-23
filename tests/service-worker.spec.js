import { expect, test } from "@playwright/test";

// The lightweight headless shell refuses notification permission; full Chromium allows it.
test.use({ channel: "chromium" });

test("a push shows a notification for its chat", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["notifications"], { origin: baseURL });
  await page.goto("/signin");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await context.newCDPSession(page);
  const registered = new Promise(resolve => cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
    const active = registrations.find(r => r.scopeURL === `${baseURL}/` && !r.isDeleted);
    if (active) resolve(active.registrationId);
  }));
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: baseURL, registrationId: await registered,
    data: JSON.stringify({ title: "Test friend", body: "Hello there", room: "room-1", url: "/chat?chat=room-1" }),
  });
  await expect.poll(() => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications())
    .map(n => ({ title: n.title, body: n.body, tag: n.tag, url: n.data.url })))).toEqual([
    { title: "Test friend", body: "Hello there", tag: "room-1", url: "/chat?chat=room-1" },
  ]);
});
