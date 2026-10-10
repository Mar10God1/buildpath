"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BuildPathLogo } from "@/components/buildpath-logo";

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const supabase = createClient();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setBusy(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("Account created. Check your email to confirm it, then sign in.");
      return;
    }

    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next || "/setup";
  }

  return (
    <main className="auth-layout">
      <section className="auth-side">
        <BuildPathLogo/>
        <div className="auth-card">
          <span className="setup-kicker">CONSTRUCTION PROJECT INTELLIGENCE</span>
          <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p>Your jobs, daily logs, change orders and field photos, all in one place.</p>
          <form className="auth-form" onSubmit={submit}>
            <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></label>
            <label>Password<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            {message && <div className="form-message">{message}</div>}
            <button className="primary-action" type="submit" disabled={busy}>{busy ? "Working…" : mode === "login" ? "Sign in →" : "Create account →"}</button>
          </form>
          <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
            {mode === "login" ? "Don’t have an account? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </section>
      <section className="auth-hero">
        <div>
          <h2>Connect every part of your build.</h2>
          <p>Projects, documents, vendors, schedule, and cost — all in one place for a more connected, more productive construction team.</p>
          <div className="auth-hero-accent"/>
        </div>
      </section>
    </main>
  );
}
