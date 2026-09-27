import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { nodeDatabase } from "../src/server/db/node";
import { openDatabase } from "../src/server/db/sqlite";
import { migrate } from "../src/server/db/migrate";
import { securityConfig } from "../src/server/security/config";
import {
  decryptSecret,
  encryptSecret,
  hash,
  randomToken,
} from "../src/server/security/crypto";
import { authenticated, cookie, logout } from "../src/server/auth/service";
import { handleSecurity } from "../src/server/security/http";
import { startWorker } from "../scripts/worker-runtime";

const root = "a1".repeat(32),
  setup = "b2".repeat(32);
const env = {
  CREDENTIAL_ROOT_KEY: root,
  OWNER_SETUP_TOKEN: setup,
  APP_ORIGIN: "https://example.test",
};
const config = securityConfig(env);

test("security configuration rejects missing/invalid keys, origins and RP IDs", () => {
  for (const override of [
    { CREDENTIAL_ROOT_KEY: undefined },
    { CREDENTIAL_ROOT_KEY: "bad" },
    { APP_ORIGIN: "http://example.test" },
    { APP_ORIGIN: "http://127.0.0.1:3000" },
    { APP_ORIGIN: "https://example.test/" },
    { WEBAUTHN_RP_ID: "other.test" },
    { OWNER_SETUP_TOKEN: "short" },
  ])
    assert.throws(() => securityConfig({ ...env, ...override }));
  assert.equal(
    securityConfig({ ...env, OWNER_SETUP_TOKEN: undefined }).setupToken,
    undefined,
  );
  const value = cookie(config, "session", "opaque", 100);
  for (const flag of [
    "__Host-",
    "Secure",
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
  ])
    assert.ok(value.includes(flag));
});

test("setup token cannot reuse the root key, including equivalent hexadecimal casing", () => {
  for (const setupToken of [root, root.toUpperCase()]) {
    assert.throws(
      () => securityConfig({ ...env, OWNER_SETUP_TOKEN: setupToken }),
      {
        message:
          "OWNER_SETUP_TOKEN must differ from CREDENTIAL_ROOT_KEY. Generate a separate setup token.",
      },
    );
  }
  assert.equal(securityConfig(env).setupToken, setup);
  assert.equal(
    securityConfig({ ...env, OWNER_SETUP_TOKEN: undefined }).setupToken,
    undefined,
  );
});

test("AES-GCM encrypts structured payloads with random IVs and rejects wrong keys, tampering and record swaps", async () => {
  const payload = { access: "private-access", secret: "private-secret" };
  const encrypted = await encryptSecret(root, "one", "provider", payload);
  assert.ok(!encrypted.includes(payload.secret));
  assert.notEqual(
    encrypted,
    await encryptSecret(root, "one", "provider", payload),
  );
  assert.deepEqual(
    await decryptSecret(root, "one", "provider", encrypted),
    payload,
  );
  await assert.rejects(
    decryptSecret("c3".repeat(32), "one", "provider", encrypted),
  );
  await assert.rejects(decryptSecret(root, "two", "provider", encrypted));
  await assert.rejects(decryptSecret(root, "one", "other", encrypted));
  const tampered = JSON.parse(encrypted);
  tampered.data =
    (tampered.data[0] === "A" ? "B" : "A") + tampered.data.slice(1);
  await assert.rejects(
    decryptSecret(root, "one", "provider", JSON.stringify(tampered)),
  );
  await assert.rejects(
    decryptSecret(
      root,
      "one",
      "provider",
      JSON.stringify({ ...JSON.parse(encrypted), v: 2 }),
    ),
  );
});

for (const target of ["sqlite", "workerd-d1"] as const) {
  test(`${target}: authenticated credential API, storage invariants and failure boundaries`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "3template-security-"));
    const path = join(directory, "db.sqlite");
    const migrationDb = openDatabase(path, true);
    migrate(migrationDb, resolve("migrations"));
    migrationDb.close();
    const db = nodeDatabase(path);
    const worker = target === "workerd-d1" ? await startWorker(env) : null;
    const d1 = worker ? await worker.getD1Database("DB") : null;
    async function query<T>(
      sql: string,
      params: (string | number | null)[] = [],
    ): Promise<T[]> {
      if (d1)
        return (
          await d1
            .prepare(sql)
            .bind(...params)
            .all<T>()
        ).results;
      return db.query<T>(sql, params);
    }
    const token = randomToken();
    async function call(
      pathname: string,
      data?: unknown,
      authenticatedRequest = true,
      origin = config.origin,
    ) {
      const request = new Request(`${config.origin}${pathname}`, {
        method: data === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: authenticatedRequest
            ? `__Host-3template-session=${token}`
            : "",
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      const response = worker
        ? await worker.dispatchFetch(request.url, request)
        : await handleSecurity(request, db, config);
      const text = await response.text();
      assert.ok(!text.includes("test-valid-secret-one"));
      return { status: response.status, data: JSON.parse(text) };
    }
    try {
      assert.equal(
        (await call("/api/credentials", undefined, false)).status,
        401,
      );
      assert.equal((await call("/api/credentials", {}, false)).status, 401);
      assert.equal(
        (
          await call(
            "/api/auth/register/options",
            { name: "Owner", setupToken: "wrong" },
            false,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await call(
            "/api/auth/register/options",
            { name: "Owner", setupToken: setup },
            false,
          )
        ).status,
        200,
      );
      await query(
        "INSERT INTO owner (id, name, user_handle, created_at) VALUES (1, 'Owner', 'handle', 1)",
      );
      await assert.rejects(
        query(
          "INSERT INTO owner (id, name, user_handle, created_at) VALUES (2, 'Other', 'other', 1)",
        ),
      );
      await query("INSERT INTO session VALUES (?, 1, ?)", [
        await hash(token),
        Date.now() + 60000,
      ]);
      assert.equal(
        (
          await call(
            "/api/auth/register/options",
            { name: "Other", setupToken: setup },
            false,
          )
        ).status,
        409,
      );
      assert.equal(
        (await call("/api/credentials", {}, true, "https://evil.test")).status,
        403,
      );
      const first = (
        await call("/api/credentials", {
          provider: "test-token",
          name: "First",
          secret: { token: "test-valid-secret-one" },
        })
      ).data.id;
      const second = (
        await call("/api/credentials", {
          provider: "test-token",
          name: "First",
          secret: { token: "invalid" },
        })
      ).data.id;
      const third = await call("/api/credentials", {
        provider: "test-pair",
        name: "Pair",
        secret: {
          accessKey: "test-valid-access",
          secretKey: "test-valid-secret",
        },
        verify: true,
      });
      assert.equal(third.status, 201);
      assert.equal(
        (await call(`/api/credentials/${first}`, { action: "verify" })).status,
        200,
      );
      assert.equal(
        (await call(`/api/credentials/${second}`, { action: "verify" })).status,
        400,
      );
      let entries = (await call("/api/credentials")).data.credentials;
      assert.equal(entries.length, 3);
      assert.equal(
        entries.find((r: { id: string }) => r.id === first).status,
        "valid",
      );
      assert.ok(
        entries.find((r: { id: string }) => r.id === first).lastVerifiedAt,
      );
      assert.equal(
        entries.find((r: { id: string }) => r.id === second).status,
        "invalid",
      );
      assert.ok(!JSON.stringify(entries).includes("encryptedSecret"));
      const [stored] = await query<{ encrypted_secret: string }>(
        "SELECT encrypted_secret FROM credential WHERE id = ?",
        [first],
      );
      assert.equal(
        (
          await decryptSecret(
            root,
            first,
            "test-token",
            stored.encrypted_secret,
          )
        ).token,
        "test-valid-secret-one",
      );
      await call(`/api/credentials/${first}`, { action: "default" });
      await call(`/api/credentials/${second}`, { action: "default" });
      await assert.rejects(
        query("UPDATE credential SET is_default = 1 WHERE id = ?", [first]),
      );
      await call(`/api/credentials/${first}`, {
        action: "replace",
        secret: { token: "test-valid-new" },
      });
      const [replacement] = await query<{
        encrypted_secret: string;
        status: string;
        last_verified_at: number | null;
      }>("SELECT * FROM credential WHERE id = ?", [first]);
      assert.notEqual(replacement.encrypted_secret, stored.encrypted_secret);
      assert.equal(replacement.status, "unverified");
      assert.equal(replacement.last_verified_at, null);
      await query(
        "UPDATE credential SET encrypted_secret = 'tampered' WHERE id = ?",
        [first],
      );
      assert.equal(
        (await call(`/api/credentials/${first}`, { action: "verify" })).status,
        400,
      );
      await call(`/api/credentials/${first}`, {
        action: "rename",
        name: "Renamed",
      });
      await call(`/api/credentials/${second}`, { action: "delete" });
      entries = (await call("/api/credentials")).data.credentials;
      assert.equal(entries.length, 2);
      assert.ok(entries.every((r: { isDefault: number }) => !r.isDefault));
      await query("UPDATE session SET expires_at = 0");
      assert.equal((await call("/api/credentials")).status, 401);
      await query("UPDATE session SET expires_at = ?", [Date.now() + 60000]);
      assert.equal((await call("/api/auth/logout", {})).status, 200);
      assert.equal((await call("/api/credentials")).status, 401);
      if (!worker)
        assert.ok(
          !readFileSync(path).includes(Buffer.from("test-valid-secret-one")),
        );
    } finally {
      db.close();
      if (worker) await worker.dispose();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test("invalid and expired session tokens are rejected and logout removes access", async () => {
  const directory = mkdtempSync(join(tmpdir(), "3template-session-")),
    path = join(directory, "db.sqlite");
  const initial = openDatabase(path, true);
  migrate(initial, resolve("migrations"));
  initial.close();
  const db = nodeDatabase(path);
  try {
    await db.query("INSERT INTO owner VALUES (1, 'Owner', 'handle', 0)");
    const token = randomToken();
    await db.query("INSERT INTO session VALUES (?, 1, 100)", [
      await hash(token),
    ]);
    assert.equal(await authenticated(db, token, 99), true);
    assert.equal(await authenticated(db, token, 100), false);
    assert.equal(await authenticated(db, randomToken(), 99), false);
    await logout(db, token);
    assert.equal(await authenticated(db, token, 99), false);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
