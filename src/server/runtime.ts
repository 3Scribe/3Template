import "server-only";
import { nodeDatabase } from "./db/node";
import { getServerConfig } from "./env";
import { securityConfig } from "./security/config";

export function runtime() {
  const config = securityConfig(process.env);
  return { db: nodeDatabase(getServerConfig().databasePath), config };
}
