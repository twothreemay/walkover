"use client";

import { FormEvent, useState } from "react";

export default function AccessRequestForm({ user, existingStatus }: { user: { name: string; email: string }; existingStatus: string | null }) {
  const [status, setStatus] = useState(existingStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organisation: form.get("organisation"), reason: form.get("reason") }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setError(data.error || "Request could not be submitted");
    setStatus("pending");
  }

  return <main className="access-shell">
    <a className="brand access-brand" href="/"><span className="brand-mark">W</span><span>WALKOVER</span></a>
    <section className="access-card">
      <span className="eyebrow">ADMIN ACCESS</span>
      <h1>{status === "pending" ? "Request received" : status === "rejected" ? "Access not approved" : "Request admin access"}</h1>
      {status === "pending" ? <p>Your request is awaiting review. You’ll be able to open the admin workspace once an existing administrator approves it.</p> : (
        <>
          <p>Admin rights let you create, edit, delete and share project records. Your signed-in identity will be attached to the request.</p>
          <div className="identity-box"><span>Signed in as</span><b>{user.name}</b><small>{user.email}</small></div>
          <form onSubmit={submit}>
            <label>Organisation<input name="organisation" placeholder="Company or authority" required /></label>
            <label>Why do you need admin access?<textarea name="reason" placeholder="Briefly describe your role and intended use" required /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary" disabled={busy}>{busy ? "Submitting…" : "Submit request"}</button>
          </form>
        </>
      )}
      <a className="back-link" href="/">← Return to Walkover</a>
    </section>
  </main>;
}
