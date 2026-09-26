import "server-only";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

export function migrate(db: DatabaseSync, directory: string) {
  const files = readdirSync(directory)
    .filter((file) => /^\d{4}_[\w-]+\.sql$/.test(file))
    .sort();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)",
    );
    const applied = db
      .prepare("SELECT name, checksum FROM _migrations")
      .all() as { name: string; checksum: string }[];
    for (const migration of applied) {
      if (!files.includes(migration.name))
        throw new Error(
          "An applied migration is missing. Restore migration history before continuing.",
        );
    }
    for (const name of files) {
      const sql = readFileSync(join(directory, name), "utf8");
      const checksum = createHash("sha256")
        .update(sql.replace(/\r\n/g, "\n"))
        .digest("hex");
      const existing = applied.find((migration) => migration.name === name);
      if (existing) {
        if (existing.checksum !== checksum)
          throw new Error(
            `Applied migration ${name} has changed. Add a new migration instead.`,
          );
        continue;
      }
      if (applied.some((migration) => migration.name > name))
        throw new Error(
          "New migrations must follow existing migration history.",
        );
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (name, checksum) VALUES (?, ?)").run(
        name,
        checksum,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
