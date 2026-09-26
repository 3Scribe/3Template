import nextEnv from "@next/env";
import { resolve } from "node:path";
import { getServerConfig } from "../src/server/env";
import { openDatabase } from "../src/server/db/sqlite";
import { migrate } from "../src/server/db/migrate";

nextEnv.loadEnvConfig(process.cwd());
const db = openDatabase(getServerConfig().databasePath, true);
try {
  migrate(db, resolve("migrations"));
  console.log("Database migrations applied.");
} finally {
  db.close();
}
