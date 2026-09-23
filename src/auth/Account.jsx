import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { supabase, configured } from "../services/supabase";
import { useSession } from "./SessionContext";
import logo from "../assets/logonobg.png";

export function Account({ mode = "signin" }) {
  const { user, ready, error: sessionError } = useSession();
  const navigate = useNavigate();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const signup = mode === "signup";
  const reset = mode === "reset";
  const update = mode === "update";
  const title = signup ? "Create your account" : reset ? "Reset password" : update ? "Choose a new password" : "Welcome back";
  if (user && !update) return <Navigate to="/chat" replace />;

  async function submit(event) {
    event.preventDefault();
    if (pending || !configured) return;
    setPending("email"); setError(""); setNotice("");
    const values = new FormData(event.currentTarget);
    const email = values.get("email")?.trim();
    const password = values.get("password");
    try {
      let result;
      if (signup) result = await supabase.auth.signUp({
        email, password,
        options: { data: { display_name: values.get("displayName").trim() }, emailRedirectTo: `${location.origin}/chat` },
      });
      else if (reset) result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/update-password` });
      else if (update) result = await supabase.auth.updateUser({ password });
      else result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (reset || (signup && !result.data.session)) setNotice("Check your email for the confirmation link.");
      else if (update) navigate("/chat", { replace: true });
    } catch (e) { setError(e.message); } finally { setPending(""); }
  }

  async function google() {
    if (pending || !configured) return;
    setPending("google"); setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google", options: { redirectTo: `${location.origin}/chat` },
    });
    if (authError) { setError(authError.message); setPending(""); }
  }

  return <main className="account-page">
    <img className="account-logo" src={logo} alt="Chatterly" />
    <form className="account-form" onSubmit={submit}>
      <span className="eyebrow">YOUR PEOPLE, ONE PLACE</span>
      <h1>{title}</h1>
      {!configured && <p className="notice" role="status">Chat service is not connected yet.</p>}
      {signup && <label>Display name<input name="displayName" autoComplete="nickname" required maxLength={60} disabled={!!pending} /></label>}
      {!update && <label>Email<input name="email" type="email" autoComplete="email" required disabled={!!pending} /></label>}
      {!reset && <label>Password<input name="password" type="password" minLength={signup || update ? 8 : 1}
        autoComplete={signup || update ? "new-password" : "current-password"} required disabled={!!pending} /></label>}
      {(error || sessionError) && <p className="error" role="alert">{error || sessionError}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      <button className="button primary" disabled={!configured || !ready || !!pending} type="submit">
        {pending === "email" ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
        {signup ? "Create account" : reset ? "Send reset link" : update ? "Save password" : "Sign in"}
      </button>
      {!reset && !update && <>
        <div className="account-divider">or</div>
        <button className="button secondary" type="button" onClick={google} disabled={!configured || !ready || !!pending}>
          {pending === "google" && <LoaderCircle className="spin" size={18} />}Continue with Google
        </button>
      </>}
      <div className="account-links">
        <Link to={signup || reset || update ? "/signin" : "/signup"}>{signup || reset || update ? "Back to sign in" : "Create an account"}</Link>
        {!signup && !reset && !update && <Link to="/reset-password">Forgot password?</Link>}
      </div>
    </form>
  </main>;
}
