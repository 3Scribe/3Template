import "server-only";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import type { Database } from "../db/port";
import type { SecurityConfig } from "./config";
import {
  authenticated,
  beginLogin,
  beginRegistration,
  challengeSeconds,
  cookie,
  finishLogin,
  finishRegistration,
  hasOwner,
  logout,
  readCookie,
  sessionSeconds,
} from "../auth/service";
import {
  createCredential,
  listCredentials,
  updateCredential,
} from "../credentials/service";
import { providerDescriptors } from "../credentials/providers";
import { object, PublicError } from "./errors";

async function body(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new PublicError("JSON request required.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new PublicError("Request body required.");
  let length = 0,
    text = "";
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 32768) {
      await reader.cancel();
      throw new PublicError("Request too large.", 413);
    }
    text += decoder.decode(value, { stream: true });
  }
  try {
    return object(JSON.parse(text + decoder.decode()));
  } catch {
    throw new PublicError("Invalid JSON request.");
  }
}
export async function handleSecurity(
  request: Request,
  db: Database,
  config: SecurityConfig,
): Promise<Response> {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
  });
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  try {
    const path = new URL(request.url).pathname;
    if (!["GET", "POST"].includes(request.method))
      throw new PublicError("Method not allowed.", 405);
    if (
      request.method === "POST" &&
      (request.headers.get("origin") !== config.origin ||
        request.headers.get("sec-fetch-site") === "cross-site")
    )
      throw new PublicError("Request origin is not allowed.", 403);
    const session = readCookie(request, config, "session");
    if (path === "/api/auth/status" && request.method === "GET")
      return reply({
        hasOwner: await hasOwner(db),
        authenticated: await authenticated(db, session),
      });
    const authPaths = [
      "/api/auth/register/options",
      "/api/auth/register/verify",
      "/api/auth/login/options",
      "/api/auth/login/verify",
    ];
    if (authPaths.includes(path) && request.method === "POST") {
      const input = await body(request);
      if (path.endsWith("/options")) {
        const result = path.includes("/register/")
          ? await beginRegistration(db, config, input)
          : await beginLogin(db, config);
        headers.append(
          "Set-Cookie",
          cookie(config, "challenge", result.token, challengeSeconds),
        );
        return reply(result.options);
      }
      const challenge = readCookie(request, config, "challenge");
      const token = path.includes("/register/")
        ? await finishRegistration(
            db,
            config,
            challenge,
            input as unknown as RegistrationResponseJSON,
          )
        : await finishLogin(
            db,
            config,
            challenge,
            input as unknown as AuthenticationResponseJSON,
          );
      // Successful authentication rotates the browser's existing session too.
      if (session) await logout(db, session);
      headers.append(
        "Set-Cookie",
        cookie(config, "session", token, sessionSeconds),
      );
      headers.append("Set-Cookie", cookie(config, "challenge", "", 0));
      return reply({ ok: true });
    }
    if (!(await authenticated(db, session)))
      throw new PublicError("Sign in to continue.", 401);
    if (path === "/api/auth/logout" && request.method === "POST") {
      await logout(db, session);
      headers.append("Set-Cookie", cookie(config, "session", "", 0));
      return reply({ ok: true });
    }
    if (path === "/api/credentials" && request.method === "GET")
      return reply({
        credentials: await listCredentials(db),
        providers: providerDescriptors(),
      });
    if (path === "/api/credentials" && request.method === "POST") {
      const id = await createCredential(
        db,
        config.rootKey,
        await body(request),
      );
      return reply({ id }, 201);
    }
    const match = /^\/api\/credentials\/([\w-]+)$/.exec(path);
    if (match && request.method === "POST") {
      const input = await body(request);
      await updateCredential(db, config.rootKey, match[1], input.action, input);
      return reply({ ok: true });
    }
    throw new PublicError("Not found.", 404);
  } catch (error) {
    if (error instanceof PublicError)
      return reply({ error: error.message }, error.status);
    // Never log arbitrary exceptions: providers and database errors may include inputs.
    return reply(
      {
        error:
          "The request could not be completed. Check the instance configuration and try again.",
      },
      500,
    );
  }
}
