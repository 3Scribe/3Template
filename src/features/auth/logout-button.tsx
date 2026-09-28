"use client";
import { useState } from "react";
export function LogoutButton() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const response = await fetch("/api/auth/logout", {
              method: "POST",
            });
            if (!response.ok) throw new Error();
            // Discard cached authenticated pages after revoking the session.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign("/login");
          } catch {
            setError("Could not sign out. Please try again.");
            setBusy(false);
          }
        }}
      >
        Sign out
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
