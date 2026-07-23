"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function WelcomePage() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState(searchParams.get("error") === "invalid-code" ? "That project code was not recognised or has expired." : "");

  function openProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code.trim();
    if (!value) {
      setError("Enter the project code supplied with your invitation.");
      return;
    }

    try {
      const url = new URL(value);
      const token = url.pathname.split("/").filter(Boolean).at(-1);
      if (token) {
        window.location.assign(`/share/${encodeURIComponent(token)}`);
        return;
      }
    } catch {
      // A normal project code is expected most of the time.
    }

    const normalised = value.replace(/[^a-zA-Z0-9]/g, "");
    if (normalised.length >= 32) {
      window.location.assign(`/share/${encodeURIComponent(normalised)}`);
      return;
    }
    if (normalised.length !== 10) {
      setError("Project codes contain 10 letters or numbers.");
      return;
    }
    window.location.assign(`/project-code/${encodeURIComponent(normalised)}`);
  }

  return (
    <main className="welcome-shell">
      <header className="welcome-top">
        <a className="brand" href="/" aria-label="Walkover home">
          <span className="brand-mark">W</span>
          <span>WALKOVER</span>
        </a>
        <a className="welcome-admin" href="/admin">Admin access <span>→</span></a>
      </header>

      <section className="welcome-panel">
        <div className="welcome-copy">
          <span className="eyebrow">3D SITE RECORDS</span>
          <h1>Return to site.<br />Without going back.</h1>
          <p>Explore an up-to-date highway walkover, inspect the reality capture and review project information from any browser.</p>
        </div>

        <form className="code-card" onSubmit={openProject}>
          <span className="code-step">PROJECT ACCESS</span>
          <h2>Open a walkover</h2>
          <p>Enter the code shared by your project administrator.</p>
          <label htmlFor="project-code">PROJECT CODE</label>
          <input
            id="project-code"
            value={code}
            onChange={(event) => { setCode(event.target.value.toUpperCase()); setError(""); }}
            placeholder="XXXXX–XXXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby={error ? "code-error" : undefined}
          />
          {error && <div className="code-error" id="code-error" role="alert">{error}</div>}
          <button type="submit">Open project <span>→</span></button>
          <small>Codes are supplied with project invitations and may expire.</small>
        </form>
      </section>

      <footer className="welcome-footer">
        <span>Walkover</span>
        <span>Secure highway reality capture</span>
      </footer>
    </main>
  );
}
