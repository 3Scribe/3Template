import nextEnv from "@next/env";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { getServerConfig } from "../src/server/env";
import { openDatabase } from "../src/server/db/sqlite";

nextEnv.loadEnvConfig(process.cwd());
const db = openDatabase(getServerConfig().databasePath, true);
try {
  db.exec("BEGIN IMMEDIATE");
  try {
    const key = `smoke-${randomUUID()}`;
    db.prepare("INSERT INTO instance_metadata (key, value) VALUES (?, ?)").run(
      key,
      "ok",
    );
    assert.equal(
      db.prepare("SELECT value FROM instance_metadata WHERE key = ?").get(key)
        ?.value,
      "ok",
    );
  } finally {
    db.exec("ROLLBACK");
  }
  console.log("Database read/write smoke check passed; no test data retained.");
} finally {
  db.close();
}
