// Browser-only Firebase doubles keep routing tests isolated from real accounts.
export const authModule = `
const state = window.__firebaseTest;
const listeners = new Set();
export const auth = { get currentUser() { return state.user; } };

export function onAuthStateChanged(instance, callback) {
  listeners.add(callback);
  queueMicrotask(() => {
    if (listeners.has(callback)) callback(state.user);
  });
  return () => listeners.delete(callback);
}

function notify(user) {
  state.user = user;
  if (user) sessionStorage.setItem("test-user", JSON.stringify(user));
  else sessionStorage.removeItem("test-user");
  listeners.forEach(callback => callback(user));
}

async function signIn(method, email) {
  state.calls.push({ method, email });
  await new Promise(resolve => setTimeout(resolve, 50));
  if (state.authError) {
    throw Object.assign(new Error("Test sign-in failure"), { code: state.authError });
  }
  const user = { uid: "test-user", email: email || "member@example.test", displayName: "Test member" };
  notify(user);
  return { user };
}

export const signInWithEmailAndPassword = (instance, email) => signIn("email", email);
export const signInWithPopup = () => signIn("google");
export const signOut = async () => notify(null);
export const createUserWithEmailAndPassword = () => { throw new Error("Unexpected signup"); };
`;

export const databaseModule = `
const state = window.__firebaseTest;
const snapshot = value => ({ val: () => value, exists: () => value !== null });
const denied = () => Object.assign(new Error("Permission denied"), { code: "PERMISSION_DENIED" });
export const ref = (database, path) => ({ path });
export const query = reference => reference;
export const orderByChild = () => ({});
export const equalTo = () => ({});
export const serverTimestamp = () => Date.now();
export const push = () => ({ key: "test-message" });
export const update = async () => {};
export async function set(reference, value) {
  state.profileWrites.push(value);
  if (state.database === "write-denied") throw denied();
}
export async function get() {
  if (state.database === "pending") return new Promise(() => {});
  if (state.database === "denied") throw denied();
  return snapshot(state.profileExists ? { userName: "Existing member" } : null);
}
export function onValue(reference, callback, onError) {
  let active = true;
  queueMicrotask(() => {
    if (!active || state.database === "pending") return;
    if (state.database === "denied") {
      onError?.(denied());
      return;
    }
    callback(snapshot(reference.path.startsWith("users/") ? { userName: "Test member" } : null));
  });
  return () => { active = false; };
}
`;

export async function mockFirebase(page, options = {}) {
  await page.addInitScript((settings) => {
    window.__firebaseTest = {
      user: JSON.parse(sessionStorage.getItem("test-user") || "null"),
      authError: null,
      database: "ready",
      profileExists: true,
      calls: [],
      profileWrites: [],
      ...settings,
    };
  }, options);

  const serveModule = (body) => (route) => route.fulfill({
    contentType: "application/javascript",
    body,
  });
  await page.route("**/__test_auth.js", serveModule(authModule));
  await page.route("**/src/firebase.jsx*", serveModule(`
    export { auth } from "/__test_auth.js";
    export const googleAuth = {};
    export const db = {};
  `));
  await page.route("**/node_modules/.vite/deps/firebase_auth.js*", serveModule('export * from "/__test_auth.js";'));
  await page.route("**/node_modules/.vite/deps/firebase_database.js*", serveModule(databaseModule));
}
