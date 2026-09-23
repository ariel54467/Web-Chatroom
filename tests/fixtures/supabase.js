// Network-level Supabase doubles keep browser tests away from real accounts and data.
import { Buffer } from "node:buffer";

export const supabaseUrl = "http://supabase.test";
export const supabaseKey = "test-publishable-key";
// Any 65-byte P-256 public key works; the push service is simulated too.
export const vapidKey = "BNH0387fWhiKjzKQm5zT80f_WPaTK2WJU43_mv598p_kIPC4VJ6fbUzOTfUDAnj1YVPLFsy-c-iOpRld37zX2rA";
const storageKey = "sb-supabase-auth-token";

export const member = {
  id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated",
  email: "member@example.test", user_metadata: { display_name: "Test member" },
  app_metadata: { provider: "email" }, created_at: "2026-01-01T00:00:00Z",
};
export const profile = { id: member.id, username: "member", display_name: "Test member", avatar_path: null };
export const friend = { id: "00000000-0000-4000-8000-000000000002", username: "friend", display_name: "Test friend", avatar_path: null };
export const room = "00000000-0000-4000-8000-000000000010";
export const directChat = {
  id: room, kind: "direct", name: friend.display_name, avatar_path: null, peer_id: friend.id,
  last_message: "No messages yet", updated_at: "2026-01-01T10:00:00Z", unread: 0, member_count: 2,
};

const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
function session(user = member) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, role: "authenticated", exp: expires })}.test`,
    token_type: "bearer", expires_in: 3600, expires_at: expires, refresh_token: "test-refresh-token", user,
  };
}

function cors(request) {
  const headers = request.headers();
  return {
    "access-control-allow-origin": headers.origin || "*",
    "access-control-allow-headers": headers["access-control-request-headers"] || "*",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-expose-headers": "content-range, x-supabase-api-version",
  };
}

class RpcError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function mockSupabase(page, options = {}) {
  const api = {
    signedIn: false, authError: null, profile: { ...profile }, rooms: [], messages: [], failSends: 0,
    ...options, calls: [], unexpected: [],
    authCalls: () => api.calls.filter(call => call.auth),
    rpcCalls: name => api.calls.filter(call => call.rpc === name).map(call => call.args),
    pushCalls: () => api.calls.filter(call => call.push).map(call => call.push),
  };
  const members = () => [
    { room_id: room, user_id: member.id, role: "member", last_read_at: "2026-01-01T00:00:00Z", profile: api.profile },
    { room_id: room, user_id: friend.id, role: "member", last_read_at: "2026-01-01T00:00:00Z", profile: friend },
  ];
  const rpc = {
    social_state: () => ({ contacts: [friend], requests: [], invites: [], blocked: [] }),
    list_rooms: () => api.rooms,
    room_details: ({ p_room }) => api.rooms.some(r => r.id === p_room) ? {
      room: { id: p_room, kind: "direct", name: "Private chat", avatar_path: null },
      can_send: true, members: members(), invites: [], typing: [],
    } : null,
    get_messages: ({ p_room }) => api.messages.filter(m => m.room_id === p_room).reverse(),
    send_message: args => {
      if (api.failSends > 0) { api.failSends--; throw new RpcError("Temporary database failure.", 500); }
      const existing = api.messages.find(m => m.id === args.p_id);
      if (existing) return existing;
      const message = {
        id: args.p_id, room_id: args.p_room, sender_id: member.id, kind: args.p_kind, body: args.p_body.trim(),
        storage_path: args.p_storage_path, external_url: args.p_external_url, file_name: args.p_file_name,
        created_at: new Date().toISOString(),
      };
      api.messages.push(message);
      return message;
    },
    save_profile: args => (api.profile = {
      ...api.profile, username: args.p_username, display_name: args.p_display_name, avatar_path: args.p_avatar_path,
    }),
    mark_read: () => null,
    save_push_subscription: () => null,
    delete_push_subscription: () => null,
    set_typing: () => null,
  };

  if (api.push) await page.addInitScript(simulatePush, api.push);
  if (api.signedIn) {
    await page.addInitScript(([key, value]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    }, [storageKey, JSON.stringify(session())]);
  }
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, () => { /* Keep realtime offline; nothing is sent to a server. */ });
  await page.route(`${supabaseUrl}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors(request) });
    let body = null;
    try { body = request.postDataJSON(); } catch { /* Not a JSON request. */ }
    const reply = (data, status = 200) => route.fulfill({
      status, headers: cors(request), contentType: "application/json", body: JSON.stringify(data),
    });

    if (url.pathname === "/auth/v1/authorize") {
      const redirectTo = url.searchParams.get("redirect_to");
      api.calls.push({ auth: "authorize", provider: url.searchParams.get("provider"), redirectTo, pkce: url.searchParams.has("code_challenge") });
      // A redirect_to missing from Supabase's allow list falls back to the Site URL (the root).
      const target = new URL(api.oauthLanding ?? redirectTo, redirectTo);
      if (api.oauthError) target.searchParams.set("error_description", api.oauthError);
      else target.searchParams.set("code", "test-code");
      return route.fulfill({ status: 302, headers: { location: target.href } });
    }
    if (url.pathname === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") api.calls.push({ auth: "password", email: body.email });
      else if (grant === "pkce") api.calls.push({ auth: "pkce", code: body.auth_code, verifier: Boolean(body.code_verifier) });
      else api.calls.push({ auth: grant });
      if (grant === "password" && api.authError) {
        return reply({ code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }, 400);
      }
      return reply(session());
    }
    if (url.pathname === "/auth/v1/signup") {
      api.calls.push({ auth: "signup", email: body.email, displayName: body.data?.display_name });
      // Email confirmation is on, so Supabase returns the user without a session.
      return reply({ ...member, id: "00000000-0000-4000-8000-000000000003", email: body.email, user_metadata: body.data });
    }
    if (url.pathname === "/auth/v1/logout") {
      api.calls.push({ auth: "logout" });
      return route.fulfill({ status: 204, headers: cors(request) });
    }
    if (url.pathname === "/rest/v1/profiles") return reply(api.profile);
    if (url.pathname === "/functions/v1/push") {
      api.calls.push({ push: body?.message_id });
      return reply({ sent: 1, failed: 0, removed: 0 });
    }
    const name = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/)?.[1];
    if (name && rpc[name]) {
      api.calls.push({ rpc: name, args: body });
      try { return reply(rpc[name](body ?? {})); }
      catch (error) { return reply({ code: "P0001", message: error.message }, error.status ?? 400); }
    }
    api.unexpected.push(`${request.method()} ${url.pathname}`);
    return reply({ message: "Unexpected test request." }, 404);
  });
  return api;
}

// Runs in the page: stands in for the browser's permission prompt and push service.
function simulatePush({ permission = "default", answer = "granted", subscribed = false }) {
  const state = window.__push = { permission, answer, subscription: null, subscribeOptions: null };
  const subscription = () => ({
    endpoint: "https://push.example.test/device-1",
    toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "test-p256dh", auth: "test-auth" } }; },
    async unsubscribe() { state.subscription = null; return true; },
  });
  if (subscribed) state.subscription = subscription();
  Object.defineProperty(Notification, "permission", { configurable: true, get: () => state.permission });
  Notification.requestPermission = async () => (state.permission = state.answer);
  PushManager.prototype.getSubscription = async () => state.subscription;
  PushManager.prototype.subscribe = async options => {
    state.subscribeOptions = { userVisibleOnly: options.userVisibleOnly, keyBytes: new Uint8Array(options.applicationServerKey).length };
    return (state.subscription = subscription());
  };
}
