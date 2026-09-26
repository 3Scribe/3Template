import "server-only";
import { getServerConfig } from "../env";
import { openDatabase } from "./sqlite";

export function checkInstance() {
  const db = openDatabase(getServerConfig().databasePath);
  try {
    const row = db
      .prepare("SELECT value FROM instance_metadata WHERE key = ?")
      .get("scaffold_version");
    if (row?.value !== "1")
      throw new Error("Database is not initialised. Run npm run db:migrate.");
  } finally {
    db.close();
  }
}
