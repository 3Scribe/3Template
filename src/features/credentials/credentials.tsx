"use client";
import { useState } from "react";
import type { CredentialMetadata, ProviderDescriptor } from "./types";

async function send(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}
const statuses = {
  unverified: "Unverified",
  valid: "Valid",
  invalid: "Verification failed",
  error: "Verification error",
};
export function Credentials({
  initial,
  providers,
}: {
  initial: CredentialMetadata[];
  providers: ProviderDescriptor[];
}) {
  const [entries, setEntries] = useState(initial),
    [providerId, setProviderId] = useState(providers[0].id);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [editing, setEditing] = useState<{
    id: string;
    action: "replace" | "rename" | "delete";
  } | null>(null);
  const provider = providers.find((p) => p.id === providerId)!;
  async function perform(work: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await work();
      setMessage(success);
      setEditing(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Request failed. Please try again.",
      );
    } finally {
      try {
        const response = await fetch("/api/credentials", { cache: "no-store" });
        if (response.status === 401) {
          // Discard stale authenticated router state after session expiry.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/login");
          return;
        }
        if (!response.ok) throw new Error();
        setEntries((await response.json()).credentials);
      } catch {
        setError(
          "Could not refresh credentials. Reload the page before making further changes.",
        );
      }
      setBusy(false);
    }
  }
  function secret(data: FormData, descriptor: ProviderDescriptor) {
    return Object.fromEntries(
      descriptor.fields.map((field) => [
        field.key,
        String(data.get(field.key) ?? ""),
      ]),
    );
  }
  function secretFields(descriptor: ProviderDescriptor) {
    return descriptor.fields.map((field) => (
      <label key={field.key}>
        {field.label}
        <input
          name={field.key}
          type="password"
          required
          autoComplete="off"
          maxLength={4096}
        />
      </label>
    ));
  }
  return (
    <>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <section className="panel">
        <h2>Add credential</h2>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget,
              data = new FormData(form);
            const verify =
              (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
                "value",
              ) === "verify";
            const input = {
              name: data.get("name"),
              provider: providerId,
              secret: secret(data, provider),
              verify,
            };
            form.reset();
            void perform(
              () => send("/api/credentials", input),
              verify
                ? "Credential verified and saved."
                : "Credential saved without verification.",
            );
          }}
        >
          <label>
            Provider
            <select
              value={providerId}
              onChange={(event) => setProviderId(event.target.value)}
              disabled={busy}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <p>{provider.description}</p>
          <label>
            Credential name
            <input name="name" required maxLength={100} />
          </label>
          <div key={providerId} className="form-stack">
            {secretFields(provider)}
          </div>
          <div className="actions">
            <button disabled={busy} value="verify">
              Verify and save
            </button>
            <button disabled={busy} value="save">
              Save unverified
            </button>
          </div>
        </form>
      </section>
      <h2>Saved credentials</h2>
      {entries.length === 0 && <p>No credentials yet.</p>}
      {entries.map((entry) => {
        const descriptor = providers.find((p) => p.id === entry.provider)!;
        return (
          <section className="panel" key={entry.id} aria-label={entry.name}>
            <h3>{entry.name}</h3>
            <p>
              {descriptor.name} · {statuses[entry.status]}
              {entry.isDefault ? " · Default" : ""}
            </p>
            <dl>
              <dt>Created</dt>
              <dd>{new Date(entry.createdAt).toLocaleString()}</dd>
              <dt>Updated</dt>
              <dd>{new Date(entry.updatedAt).toLocaleString()}</dd>
              <dt>Last successful verification</dt>
              <dd>
                {entry.lastVerifiedAt
                  ? new Date(entry.lastVerifiedAt).toLocaleString()
                  : "Never"}
              </dd>
            </dl>
            <div className="actions">
              <button
                disabled={busy}
                onClick={() =>
                  void perform(
                    () =>
                      send(`/api/credentials/${entry.id}`, {
                        action: "verify",
                      }),
                    "Verification succeeded.",
                  )
                }
              >
                Verify
              </button>
              <button
                disabled={busy || !!entry.isDefault}
                onClick={() =>
                  void perform(
                    () =>
                      send(`/api/credentials/${entry.id}`, {
                        action: "default",
                      }),
                    "Default credential updated.",
                  )
                }
              >
                Set default
              </button>
              {(["rename", "replace", "delete"] as const).map((action) => (
                <button
                  key={action}
                  disabled={busy}
                  onClick={() => setEditing({ id: entry.id, action })}
                >
                  {action === "replace"
                    ? "Replace secret"
                    : action === "rename"
                      ? "Rename"
                      : "Delete"}
                </button>
              ))}
            </div>
            {editing?.id === entry.id && (
              <form
                className="form-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget,
                    data = new FormData(form),
                    action = editing.action;
                  const input =
                    action === "replace"
                      ? { action, secret: secret(data, descriptor) }
                      : { action, name: data.get("name") };
                  form.reset();
                  void perform(
                    () => send(`/api/credentials/${entry.id}`, input),
                    action === "delete"
                      ? "Credential deleted."
                      : "Credential updated.",
                  );
                }}
              >
                {editing.action === "rename" && (
                  <label>
                    New name
                    <input
                      name="name"
                      defaultValue={entry.name}
                      required
                      maxLength={100}
                    />
                  </label>
                )}
                {editing.action === "replace" && (
                  <>
                    <p>
                      Replace the stored secret for {entry.name}. The old secret
                      cannot be recovered here. Verification will reset.
                    </p>
                    {secretFields(descriptor)}
                  </>
                )}
                {editing.action === "delete" && (
                  <p>
                    Delete {entry.name} permanently? If it is the default, this
                    provider will have no default.
                  </p>
                )}
                <div className="actions">
                  <button disabled={busy}>
                    {editing.action === "delete"
                      ? "Confirm delete"
                      : editing.action === "replace"
                        ? "Confirm replacement"
                        : "Save name"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        );
      })}
    </>
  );
}
