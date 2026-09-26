import type { NextConfig } from "next";
import { readConfig } from "./src/server/config";

// Next loads .env files before evaluating this configuration.
readConfig(process.env);

const config: NextConfig = { poweredByHeader: false };
export default config;
