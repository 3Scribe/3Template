import type { D1Database } from "@cloudflare/workers-types";
import { d1Database } from "../src/server/db/d1";
import { securityConfig } from "../src/server/security/config";
import { handleSecurity } from "../src/server/security/http";

interface Env {
  DB: D1Database;
  APP_ORIGIN: string;
  CREDENTIAL_ROOT_KEY: string;
  OWNER_SETUP_TOKEN?: string;
  WEBAUTHN_RP_ID?: string;
}
// Same-origin /api/* Worker entry for the security slice. Secrets come from bindings.
const worker = {
  async fetch(request: Request, env: Env) {
    try {
      return await handleSecurity(
        request,
        d1Database(env.DB),
        securityConfig({
          APP_ORIGIN: env.APP_ORIGIN,
          CREDENTIAL_ROOT_KEY: env.CREDENTIAL_ROOT_KEY,
          OWNER_SETUP_TOKEN: env.OWNER_SETUP_TOKEN,
          WEBAUTHN_RP_ID: env.WEBAUTHN_RP_ID,
        }),
      );
    } catch {
      return Response.json(
        { error: "Instance security configuration is missing or invalid." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  },
};
export default worker;
