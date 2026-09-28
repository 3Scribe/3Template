// Pure validation for runtime configuration; never return this object to the client.
export function securityConfig(env: Record<string, string | undefined>) {
  const rootKey = env.CREDENTIAL_ROOT_KEY;
  if (!rootKey || !/^[a-f\d]{64}$/i.test(rootKey)) {
    throw new Error(
      "CREDENTIAL_ROOT_KEY must contain 64 hexadecimal characters (32 random bytes).",
    );
  }
  let origin: URL;
  try {
    origin = new URL(env.APP_ORIGIN ?? "");
  } catch {
    throw new Error("APP_ORIGIN must be the exact public application origin.");
  }
  if (
    origin.origin !== env.APP_ORIGIN ||
    origin.username ||
    origin.password ||
    /^[\d.]+$/.test(origin.hostname) ||
    origin.hostname.includes(":") ||
    (origin.protocol !== "https:" &&
      !(origin.protocol === "http:" && origin.hostname === "localhost"))
  ) {
    throw new Error(
      "APP_ORIGIN must use an HTTPS domain, or HTTP localhost for local development. IP addresses cannot be passkey RP IDs.",
    );
  }
  const rpID = env.WEBAUTHN_RP_ID ?? origin.hostname;
  if (rpID !== origin.hostname)
    throw new Error("WEBAUTHN_RP_ID must match the APP_ORIGIN hostname.");
  const setupToken = env.OWNER_SETUP_TOKEN;
  if (setupToken !== undefined && !/^[a-f\d]{64}$/i.test(setupToken)) {
    throw new Error(
      "OWNER_SETUP_TOKEN must contain 64 hexadecimal characters, or be removed after setup.",
    );
  }
  if (setupToken?.toLowerCase() === rootKey.toLowerCase()) {
    throw new Error(
      "OWNER_SETUP_TOKEN must differ from CREDENTIAL_ROOT_KEY. Generate a separate setup token.",
    );
  }
  return {
    rootKey,
    origin: origin.origin,
    rpID,
    secure: origin.protocol === "https:",
    setupToken,
  };
}
export type SecurityConfig = ReturnType<typeof securityConfig>;
