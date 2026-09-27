import "server-only";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransport,
} from "@simplewebauthn/server";
import type { Database } from "../db/port";
import type { SecurityConfig } from "../security/config";
import { decode, encode, hash, randomToken } from "../security/crypto";
import { name, PublicError } from "../security/errors";

export const sessionSeconds = 12 * 60 * 60;
export const challengeSeconds = 5 * 60;
export function cookieName(
  config: SecurityConfig,
  kind: "session" | "challenge",
) {
  return `${config.secure ? "__Host-" : ""}3template-${kind}`;
}
export function cookie(
  config: SecurityConfig,
  kind: "session" | "challenge",
  token: string,
  seconds: number,
) {
  return `${cookieName(config, kind)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${config.secure ? "; Secure" : ""}`;
}
export function readCookie(
  request: Request,
  config: SecurityConfig,
  kind: "session" | "challenge",
) {
  const prefix = `${cookieName(config, kind)}=`;
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(prefix))
      ?.slice(prefix.length) ?? ""
  );
}
export async function hasOwner(db: Database) {
  return (await db.query("SELECT id FROM owner WHERE id = 1")).length > 0;
}
export async function authenticated(
  db: Database,
  token: string,
  now = Date.now(),
) {
  if (!/^[\w-]{43}$/.test(token)) return false;
  return (
    (
      await db.query(
        "SELECT token_hash FROM session WHERE token_hash = ? AND expires_at > ?",
        [await hash(token), now],
      )
    ).length > 0
  );
}
export async function logout(db: Database, token: string) {
  await db.query("DELETE FROM session WHERE token_hash = ?", [
    await hash(token),
  ]);
}
async function throttle(db: Database) {
  const now = Date.now(),
    bucket = Math.floor(now / 60000);
  const [row] = await db.query<{ attempts: number }>(
    "INSERT INTO auth_rate_limit (bucket, attempts) VALUES (?, 1) ON CONFLICT(bucket) DO UPDATE SET attempts = attempts + 1 RETURNING attempts",
    [bucket],
  );
  await db.batch([
    { sql: "DELETE FROM auth_rate_limit WHERE bucket < ?", params: [bucket] },
    { sql: "DELETE FROM auth_challenge WHERE expires_at <= ?", params: [now] },
    { sql: "DELETE FROM session WHERE expires_at <= ?", params: [now] },
  ]);
  if (row.attempts > 30)
    throw new PublicError(
      "Too many authentication attempts. Try again in a minute.",
      429,
    );
}
export async function beginRegistration(
  db: Database,
  config: SecurityConfig,
  input: Record<string, unknown>,
) {
  await throttle(db);
  if (await hasOwner(db))
    throw new PublicError("Owner setup is already complete.", 409);
  if (!config.setupToken)
    throw new PublicError(
      "Owner setup is not configured. Ask the operator to configure the setup token.",
      503,
    );
  if (
    typeof input.setupToken !== "string" ||
    (await hash(input.setupToken)) !== (await hash(config.setupToken))
  )
    throw new PublicError("Invalid setup token.", 403);
  const ownerName = name(input.name),
    handle = randomToken(),
    token = randomToken();
  const options = await generateRegistrationOptions({
    rpName: "3Template",
    rpID: config.rpID,
    userName: ownerName,
    userID: decode(handle),
    attestationType: "none",
    supportedAlgorithmIDs: [-7, -257],
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    timeout: 60000,
  });
  await db.query(
    "INSERT INTO auth_challenge (token_hash, kind, challenge, owner_name, user_handle, expires_at) VALUES (?, 'register', ?, ?, ?, ?)",
    [
      await hash(token),
      options.challenge,
      ownerName,
      handle,
      Date.now() + challengeSeconds * 1000,
    ],
  );
  return { options, token };
}
type Challenge = { challenge: string; owner_name: string; user_handle: string };
async function consume(db: Database, token: string, kind: string) {
  if (!/^[\w-]{43}$/.test(token))
    throw new PublicError(
      "Authentication request expired or is invalid. Start again.",
      401,
    );
  // DELETE RETURNING consumes the challenge exactly once, including failed verification.
  const [row] = await db.query<Challenge>(
    "DELETE FROM auth_challenge WHERE token_hash = ? AND kind = ? AND expires_at > ? RETURNING challenge, owner_name, user_handle",
    [await hash(token), kind, Date.now()],
  );
  if (!row)
    throw new PublicError(
      "Authentication request expired or is invalid. Start again.",
      401,
    );
  return row;
}
export async function finishRegistration(
  db: Database,
  config: SecurityConfig,
  token: string,
  response: RegistrationResponseJSON,
) {
  const pending = await consume(db, token, "register");
  let result;
  try {
    result = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
      supportedAlgorithmIDs: [-7, -257],
    });
  } catch {
    throw new PublicError(
      "Passkey registration could not be verified. Start again.",
      401,
    );
  }
  if (!result.verified || !result.registrationInfo)
    throw new PublicError("Passkey registration could not be verified.", 401);
  const credential = result.registrationInfo.credential;
  const session = randomToken(),
    now = Date.now();
  try {
    await db.batch([
      {
        sql: "INSERT INTO owner (id, name, user_handle, created_at) VALUES (1, ?, ?, ?)",
        params: [pending.owner_name, pending.user_handle, now],
      },
      {
        sql: "INSERT INTO passkey (id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?)",
        params: [
          credential.id,
          encode(credential.publicKey),
          credential.counter,
          JSON.stringify(credential.transports ?? []),
          now,
        ],
      },
      {
        sql: "INSERT INTO session (token_hash, owner_id, expires_at) VALUES (?, 1, ?)",
        params: [await hash(session), now + sessionSeconds * 1000],
      },
    ]);
  } catch {
    throw new PublicError(
      "Owner setup could not complete. It may already be complete; try signing in.",
      409,
    );
  }
  return session;
}
export async function beginLogin(db: Database, config: SecurityConfig) {
  await throttle(db);
  if (!(await hasOwner(db)))
    throw new PublicError("Complete owner setup first.", 409);
  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    userVerification: "required",
    timeout: 60000,
  });
  const token = randomToken();
  await db.query(
    "INSERT INTO auth_challenge (token_hash, kind, challenge, expires_at) VALUES (?, 'login', ?, ?)",
    [
      await hash(token),
      options.challenge,
      Date.now() + challengeSeconds * 1000,
    ],
  );
  return { options, token };
}
export async function finishLogin(
  db: Database,
  config: SecurityConfig,
  token: string,
  response: AuthenticationResponseJSON,
) {
  const pending = await consume(db, token, "login");
  if (!response || typeof response.id !== "string")
    throw new PublicError("Passkey authentication failed.", 401);
  const [passkey] = await db.query<{
    id: string;
    public_key: string;
    counter: number;
    transports: string;
    user_handle: string;
  }>(
    "SELECT passkey.*, owner.user_handle FROM passkey JOIN owner ON owner.id = passkey.owner_id WHERE passkey.id = ?",
    [response.id],
  );
  if (!passkey) throw new PublicError("Passkey authentication failed.", 401);
  let result;
  try {
    if (response.response.userHandle !== passkey.user_handle) throw new Error();
    result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
      credential: {
        id: passkey.id,
        publicKey: decode(passkey.public_key),
        counter: passkey.counter,
        transports: JSON.parse(passkey.transports) as AuthenticatorTransport[],
      },
    });
  } catch {
    throw new PublicError("Passkey authentication failed.", 401);
  }
  if (!result.verified)
    throw new PublicError("Passkey authentication failed.", 401);
  const updated = await db.query(
    "UPDATE passkey SET counter = ? WHERE id = ? AND counter = ? RETURNING id",
    [result.authenticationInfo.newCounter, passkey.id, passkey.counter],
  );
  if (!updated.length)
    throw new PublicError(
      "Passkey changed during authentication. Try again.",
      409,
    );
  const session = randomToken();
  await db.query(
    "INSERT INTO session (token_hash, owner_id, expires_at) VALUES (?, 1, ?)",
    [await hash(session), Date.now() + sessionSeconds * 1000],
  );
  return session;
}
