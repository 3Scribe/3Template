import { defineConfig, devices } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";

process.env.E2E_SETUP_TOKEN ??= randomBytes(32).toString("hex");
const env = {
  DATABASE_PATH: `./.cache/e2e-${randomUUID()}.sqlite`,
  APP_ORIGIN: "http://localhost:3100",
  CREDENTIAL_ROOT_KEY: randomBytes(32).toString("hex"),
  OWNER_SETUP_TOKEN: process.env.E2E_SETUP_TOKEN,
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60000,
  reporter: "list",
  use: { baseURL: env.APP_ORIGIN, trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run db:migrate && npm run start -- --port 3100",
      url: "http://localhost:3100/api/auth/status",
      reuseExistingServer: false,
      env,
    },
    {
      command:
        "node --conditions=react-server --import tsx scripts/worker-dev.ts",
      url: "http://127.0.0.1:3101/api/auth/status",
      reuseExistingServer: false,
      env,
      timeout: 120000,
    },
  ],
});
