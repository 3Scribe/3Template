import assert from "node:assert/strict";
import { test } from "node:test";
import { readConfig } from "../src/server/config";

test("configuration defaults to a local database and permits portable paths", () => {
  assert.equal(readConfig({}).databasePath, "./data/3t.sqlite");
  for (const path of [
    "./data/test.sqlite",
    "/var/lib/3t/db.sqlite",
    "C:\\data\\3t.sqlite",
  ]) {
    assert.equal(readConfig({ DATABASE_PATH: path }).databasePath, path);
  }
});

test("invalid configuration fails without echoing the supplied value", () => {
  for (const path of [
    "",
    " ",
    " test.sqlite",
    ":memory:",
    "https://secret@example.com/db",
    "file:db.sqlite",
    "bad\npath",
  ]) {
    assert.throws(() => readConfig({ DATABASE_PATH: path }), {
      message:
        "DATABASE_PATH must be a non-empty local file path (not a URL or in-memory database).",
    });
  }
});
