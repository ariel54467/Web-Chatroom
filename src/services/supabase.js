import { createClient } from "@supabase/supabase-js";

export const projectUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
export const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(projectUrl && publicKey && !projectUrl.includes("YOUR_PROJECT"));
export const supabase = configured ? createClient(projectUrl, publicKey, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
}) : null;
