"use client";
import { useState } from "react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

export function AuthForm({ setup }: { setup: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget,
      fields = new FormData(form);
    try {
      const path = setup ? "register" : "login";
      const request = await fetch(`/api/auth/${path}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          setup
            ? { name: fields.get("name"), setupToken: fields.get("setupToken") }
            : {},
        ),
      });
      const options = await request.json();
      if (!request.ok) throw new Error(options.error);
      const response = setup
        ? await startRegistration({ optionsJSON: options })
        : await startAuthentication({ optionsJSON: options });
      const verified = await fetch(`/api/auth/${path}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response),
      });
      if (!verified.ok) throw new Error((await verified.json()).error);
      form.reset();
      // Discard prefetched router state across the authentication boundary.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch (failure) {
      setError(
        failure instanceof Error && failure.name === "Error"
          ? failure.message
          : "Passkey operation was cancelled or could not complete. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="panel form-stack">
      {setup && (
        <>
          <label>
            Your name
            <input name="name" required maxLength={100} autoComplete="name" />
          </label>
          <label>
            Setup token
            <input
              name="setupToken"
              type="password"
              required
              autoComplete="off"
            />
          </label>
          <p>
            Use the setup token supplied by the person installing this instance.
            Your owner account is created when your passkey is registered.
          </p>
        </>
      )}
      <p>
        {setup
          ? "Your device will ask you to create a passkey. Keep access to that passkey: password login and account recovery are not available."
          : "Use your registered passkey to sign in."}
      </p>
      <button disabled={busy}>
        {busy
          ? "Waiting for your passkey…"
          : setup
            ? "Create owner and register passkey"
            : "Sign in with passkey"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
