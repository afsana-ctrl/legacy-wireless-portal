"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <div className="container-narrow">
      <div className="display" style={{ fontSize: 15, color: "var(--teal)", marginBottom: 10 }}>
        Legacy Wireless — Field Portal
      </div>
      <h1 className="display" style={{ fontSize: 40, lineHeight: 1.05, margin: "0 0 24px" }}>
        Every door,
        <br />
        day over day.
      </h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Email
          <input
            className="field-input"
            style={{ marginTop: 4 }}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Password
          <input
            className="field-input"
            style={{ marginTop: 4 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && (
          <div style={{ color: "var(--rust)", fontSize: 13.5 }}>{error}</div>
        )}
        <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: 8, justifyContent: "center" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p style={{ color: "var(--ink-40)", fontSize: 12.5, marginTop: 28, maxWidth: 380 }}>
        Don't have an account yet? Ask your admin to invite you — accounts are
        created from the Supabase dashboard, not signed up here.
      </p>
    </div>
  );
}
