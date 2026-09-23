import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { SessionContext } from "./SessionContext";

// Read at load, before route redirects drop the query: this is where Supabase reports a failed sign-in.
const callback = new URLSearchParams(window.location.search);
const callbackHash = new URLSearchParams(window.location.hash.slice(1));
const callbackError = callback.get("error_description") || callbackHash.get("error_description") || "";
const callbackCode = callback.has("code");

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!supabase);
  const [error, setError] = useState(callbackError);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next); setReady(true);
      if (next) setError("");
    });
    supabase.auth.initialize().then(async ({ error: callbackFailure }) => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      const failure = sessionError || callbackFailure;
      if (failure) setError(failure.message);
      else if (callbackCode && !data.session) setError("Sign-in could not be finished in this tab. Please try again.");
      setSession(data.session);
      setReady(true);
    }).catch((sessionError) => {
      if (active) { setError(sessionError.message); setReady(true); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  return <SessionContext.Provider value={{ session, user: session?.user, ready, error }}>{children}</SessionContext.Provider>;
}
