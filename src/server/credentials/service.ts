import "server-only";
import type { Database } from "../db/port";
import type { CredentialMetadata } from "../../features/credentials/types";
import { decryptSecret, encryptSecret } from "../security/crypto";
import { name, PublicError } from "../security/errors";
import { providerFor } from "./providers";

const columns =
  "id, provider, name, status, is_default AS isDefault, created_at AS createdAt, updated_at AS updatedAt, last_verified_at AS lastVerifiedAt";
export async function listCredentials(db: Database) {
  return db.query<CredentialMetadata>(
    `SELECT ${columns} FROM credential ORDER BY created_at, id`,
  );
}
async function record(db: Database, id: string) {
  const [row] = await db.query<
    CredentialMetadata & { encryptedSecret: string }
  >(
    `SELECT ${columns}, encrypted_secret AS encryptedSecret FROM credential WHERE id = ?`,
    [id],
  );
  if (!row) throw new PublicError("Credential not found.", 404);
  return row;
}
export async function createCredential(
  db: Database,
  root: string,
  input: Record<string, unknown>,
) {
  const provider = providerFor(input.provider);
  const payload = provider.validate(input.secret);
  const id = crypto.randomUUID(),
    now = Date.now();
  let verified = false;
  if (input.verify === true) {
    try {
      verified = await provider.verify(payload);
    } catch {
      throw new PublicError("Verification could not be completed.");
    }
    if (!verified)
      throw new PublicError(
        "Verification failed. Check the test provider instructions. Nothing was saved.",
      );
  }
  await db.query(
    "INSERT INTO credential (id, provider, name, encrypted_secret, status, created_at, updated_at, last_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      id,
      provider.id,
      name(input.name),
      await encryptSecret(root, id, provider.id, payload),
      verified ? "valid" : "unverified",
      now,
      now,
      verified ? now : null,
    ],
  );
  return id;
}
export async function updateCredential(
  db: Database,
  root: string,
  id: string,
  action: unknown,
  input: Record<string, unknown>,
) {
  const row = await record(db, id);
  const now = Date.now();
  switch (action) {
    case "rename":
      await db.query(
        "UPDATE credential SET name = ?, updated_at = ? WHERE id = ?",
        [name(input.name), now, id],
      );
      break;
    case "replace": {
      const payload = providerFor(row.provider).validate(input.secret);
      await db.query(
        "UPDATE credential SET encrypted_secret = ?, status = 'unverified', last_verified_at = NULL, updated_at = ? WHERE id = ?",
        [await encryptSecret(root, id, row.provider, payload), now, id],
      );
      break;
    }
    case "verify": {
      let valid: boolean;
      try {
        const provider = providerFor(row.provider);
        valid = await provider.verify(
          provider.validate(
            await decryptSecret(root, id, row.provider, row.encryptedSecret),
          ),
        );
      } catch {
        await db.query(
          "UPDATE credential SET status = 'error', updated_at = ? WHERE id = ? AND encrypted_secret = ?",
          [now, id, row.encryptedSecret],
        );
        throw new PublicError(
          "Verification could not be completed. Check the deployment configuration and try again.",
        );
      }
      const updated = await db.query(
        "UPDATE credential SET status = ?, last_verified_at = CASE WHEN ? = 1 THEN ? ELSE last_verified_at END, updated_at = ? WHERE id = ? AND encrypted_secret = ? RETURNING id",
        [
          valid ? "valid" : "invalid",
          valid ? 1 : 0,
          now,
          now,
          id,
          row.encryptedSecret,
        ],
      );
      if (!updated.length)
        throw new PublicError(
          "Credential changed during verification. Try again.",
          409,
        );
      if (!valid)
        throw new PublicError(
          "Verification failed. Replace the secret or check the test provider instructions.",
        );
      break;
    }
    case "default":
      await db.batch([
        {
          sql: "UPDATE credential SET is_default = 0, updated_at = ? WHERE provider = (SELECT provider FROM credential WHERE id = ?)",
          params: [now, id],
        },
        {
          sql: "UPDATE credential SET is_default = 1, updated_at = ? WHERE id = ?",
          params: [now, id],
        },
      ]);
      break;
    case "delete":
      await db.query("DELETE FROM credential WHERE id = ?", [id]);
      break;
    default:
      throw new PublicError("Unknown credential operation.");
  }
}
