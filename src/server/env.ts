import "server-only";
import { readConfig } from "./config";

export function getServerConfig() {
  return readConfig(process.env);
}
