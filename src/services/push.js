import { rpc } from "./chatApi";
import { supabase } from "./supabase";

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// "ready"; "install" when iPhone Safari needs the site on the Home Screen first; or "unsupported".
export function pushSupport() {
  if (!publicKey) return "unsupported";
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "ready";
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return apple && !navigator.standalone ? "install" : "unsupported";
}

export function registerWorker() {
  if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => {});
}

async function currentSubscription() {
  if (pushSupport() !== "ready") return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? registration.pushManager.getSubscription() : null;
}

async function save(subscription) {
  const { endpoint, keys } = subscription.toJSON();
  await rpc("save_push_subscription", { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth });
}

export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(permission === "denied"
    ? "Notifications are blocked for this site. Allow them in your browser's site settings, then try again."
    : "Notifications were not turned on.");
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription()
    ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  await save(subscription);
}

// Re-saves this device on each visit, so a shared device follows whoever is signed in.
export async function syncPush() {
  if (pushSupport() !== "ready" || Notification.permission !== "granted") return false;
  const subscription = await currentSubscription();
  if (!subscription) return false;
  await save(subscription);
  return true;
}

export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  try { await rpc("delete_push_subscription", { p_endpoint: subscription.endpoint }); }
  finally { await subscription.unsubscribe(); }
}

export function notifyMembers(messageId) {
  return supabase.functions.invoke("push", { body: { message_id: messageId } });
}

function keyBytes(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
}
