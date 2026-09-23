import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { SessionContext } from "./SessionContext";

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!supabase);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setReady(true); }
    });
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      else setSession(data.session);
      setReady(true);
    }).catch((sessionError) => {
      if (active) { setError(sessionError.message); setReady(true); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  return <SessionContext.Provider value={{ session, user: session?.user, ready, error }}>{children}</SessionContext.Provider>;
}
