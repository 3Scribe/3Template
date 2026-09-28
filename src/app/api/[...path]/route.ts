import { handleSecurity } from "@/server/security/http";
import { runtime } from "@/server/runtime";

async function handle(request: Request) {
  try {
    const { db, config } = runtime();
    try {
      return await handleSecurity(request, db, config);
    } finally {
      db.close();
    }
  } catch {
    return Response.json(
      {
        error:
          "Instance security configuration is missing or invalid. Ask the operator to check the configuration.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export const GET = handle;
export const POST = handle;
