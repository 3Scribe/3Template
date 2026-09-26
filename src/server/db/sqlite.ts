import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Node adapter only. D1 will use a binding, not a local file or this driver.
export function openDatabase(path: string, create = false) {
  const filename = resolve(path);
  if (create) mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename, { readOnly: !create });
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  return db;
}
