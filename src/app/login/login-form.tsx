"use client";

import { useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; redirectTo?: string };
    if (!response.ok) {
      setError(body.error ?? "Invalid email or password.");
      setPending(false);
      return;
    }
    window.location.assign(body.redirectTo ?? "/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <span className="label">Email</span>
        <input className="field" name="email" type="email" autoComplete="username" required />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input className="field" name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <button className="btn w-full" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
