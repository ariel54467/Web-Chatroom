import { defineConfig } from "@playwright/test";
import { supabaseKey, supabaseUrl, vapidKey } from "./tests/fixtures/supabase.js";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    // Point the app at the network doubles; these override any local .env values.
    env: { VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_PUBLISHABLE_KEY: supabaseKey, VITE_VAPID_PUBLIC_KEY: vapidKey },
    // A reused server could be talking to a real Supabase project.
    reuseExistingServer: false,
  },
});
