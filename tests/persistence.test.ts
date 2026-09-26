import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { openDatabase } from "../src/server/db/sqlite";
import { migrate } from "../src/server/db/migrate";

test("migrations are repeatable and data persists after reopening the database", () => {
  const directory = mkdtempSync(join(tmpdir(), "3t-test-"));
  const path = join(directory, "nested", "test.sqlite");
  try {
    const db = openDatabase(path, true);
    try {
      migrate(db, resolve("migrations"));
      db.prepare(
        "INSERT INTO instance_metadata (key, value) VALUES (?, ?)",
      ).run("smoke", "stored");
      migrate(db, resolve("migrations"));
      assert.equal(
        db.prepare("SELECT count(*) AS total FROM _migrations").get()?.total,
        1,
      );
    } finally {
      db.close();
    }
    const reopened = openDatabase(path);
    try {
      assert.equal(
        reopened
          .prepare("SELECT value FROM instance_metadata WHERE key = ?")
          .get("smoke")?.value,
        "stored",
      );
      assert.equal(
        reopened.prepare("PRAGMA foreign_keys").get()?.foreign_keys,
        1,
      );
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("failed migrations roll back and applied history cannot be rewritten", () => {
  const directory = mkdtempSync(join(tmpdir(), "3t-test-"));
  const migrations = join(directory, "migrations");
  mkdirSync(migrations);
  copyFileSync(
    resolve("migrations/0001_instance.sql"),
    join(migrations, "0001_instance.sql"),
  );
  const db = openDatabase(join(directory, "test.sqlite"), true);
  try {
    migrate(db, migrations);
    writeFileSync(
      join(migrations, "0002_failure.sql"),
      "CREATE TABLE must_rollback (id TEXT); INSERT INTO missing_table VALUES (1);",
    );
    assert.throws(() => migrate(db, migrations), /missing_table/);
    assert.equal(
      db
        .prepare("SELECT name FROM sqlite_master WHERE name = 'must_rollback'")
        .get(),
      undefined,
    );
    assert.equal(
      db.prepare("SELECT count(*) AS total FROM _migrations").get()?.total,
      1,
    );
    writeFileSync(join(migrations, "0001_instance.sql"), "SELECT 1;");
    assert.throws(() => migrate(db, migrations), /has changed/);
    rmSync(join(migrations, "0001_instance.sql"));
    assert.throws(() => migrate(db, migrations), /missing/);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
