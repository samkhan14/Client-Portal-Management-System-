"use client";

import { useState } from "react";

export function AcceptForm({ token, hasAccount }: { token: string; hasAccount: boolean }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        name: form.get("name"),
        password: form.get("password"),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; redirectTo?: string };
    if (!response.ok) {
      setError(body.error ?? "This invitation is invalid or has expired.");
      setPending(false);
      return;
    }
    window.location.assign(body.redirectTo ?? "/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {hasAccount ? (
        <p className="help">Enter the password for this email.</p>
      ) : (
        <label className="block">
          <span className="label">Your name</span>
          <input className="field" name="name" required minLength={2} autoComplete="name" />
        </label>
      )}
      <label className="block">
        <span className="label">{hasAccount ? "Password" : "Create a password"}</span>
        <input className="field" name="password" type="password" required autoComplete={hasAccount ? "current-password" : "new-password"} />
      </label>
      {!hasAccount ? <p className="help">At least 10 characters, with a letter and a number.</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <button className="btn w-full" disabled={pending} type="submit">
        {pending ? "Joining…" : "Accept invitation"}
      </button>
    </form>
  );
}
