import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export async function startWorker(bindings: Record<string, string>, port = 0) {
  const result = await build({
    entryPoints: ["workers/security.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    conditions: ["react-server"],
    external: ["node:crypto"],
  });
  const worker = new Miniflare({
    modules: true,
    script: result.outputFiles[0].text,
    compatibilityDate: "2026-07-01",
    compatibilityFlags: ["nodejs_compat"],
    bindings,
    d1Databases: ["DB"],
    port,
    host: "127.0.0.1",
  });
  try {
    const db = await worker.getD1Database("DB");
    // Test-only fresh, in-memory D1. Production uses the platform migration ledger.
    for (const file of readdirSync("migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const sql = readFileSync(resolve("migrations", file), "utf8").replace(
        /--[^\n]*/g,
        "",
      );
      await db.batch(
        sql
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => db.prepare(s)),
      );
    }
    await worker.ready;
    return worker;
  } catch (error) {
    await worker.dispose();
    throw error;
  }
}
