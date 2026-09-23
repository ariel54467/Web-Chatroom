// Sends Web Push notifications for a new chat message. The sender's browser calls this right
// after sending; claim_push decides who gets notified and makes sure it happens only once.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Push = {
  title: string; body: string; room: string; url: string;
  subscriptions: { endpoint: string; p256dh: string; auth: string }[];
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name} secret.`);
  return value;
};

webpush.setVapidDetails(env("VAPID_SUBJECT"), env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
  const { message_id } = await request.json().catch(() => ({}));
  if (typeof message_id !== "string") return reply({ error: "message_id is required." }, 400);

  // Runs as the signed-in sender, so claim_push can check they sent the message.
  const asSender = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data, error } = await asSender.rpc("claim_push", { p_message: message_id });
  if (error) return reply({ error: error.message }, 400);
  const push = data as Push | null;
  if (!push) return reply({ sent: 0 });

  const payload = JSON.stringify({ title: push.title, body: push.body, room: push.room, url: push.url });
  const gone: string[] = [];
  const results = await Promise.allSettled(push.subscriptions.map(device =>
    webpush.sendNotification({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      payload, { TTL: 60 * 60 * 24, urgency: "high" })
      .catch(error => {
        // 404 and 410 mean the browser unsubscribed or was reset.
        if (error.statusCode === 404 || error.statusCode === 410) gone.push(device.endpoint);
        throw error;
      })));
  if (gone.length) {
    const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    await admin.rpc("forget_push_subscriptions", { p_endpoints: gone });
  }
  const sent = results.filter(result => result.status === "fulfilled").length;
  return reply({ sent, failed: results.length - sent, removed: gone.length });
});
