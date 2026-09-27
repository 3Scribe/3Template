# Owner authentication and credentials

3Template Community has exactly one owner. There are no passwords, recovery codes, organisations or roles. A discoverable WebAuthn passkey with user verification is required at setup and each sign-in. Use a supported browser and authenticator. A synchronised passkey can protect against losing one device; there is no recovery or passkey-management UI in this milestone.

## Configure an installation

Use Node 24.x, run `npm ci`, copy `.env.example` to `.env.local`, then supply:

- `APP_ORIGIN`: the exact browser origin, for example `https://templates.example.com`. No path or trailing slash. HTTP is accepted only for localhost development. Always open the application using this configured origin.
- `WEBAUTHN_RP_ID`: optional; defaults to the origin's hostname and must match it if supplied. Changing this hostname invalidates the applicability of existing passkeys. Do not derive trusted origin/RP settings from request headers.
- `CREDENTIAL_ROOT_KEY`: 64 hexadecimal characters representing 32 cryptographically random bytes. This is deployment-level secret configuration, never stored in the database.
- `OWNER_SETUP_TOKEN`: a separate 64-character random hexadecimal token required to begin first-run setup. Give it only to the owner and remove it from deployment configuration after setup. If removed, remove the variable entirely rather than leaving it empty.

Generate each value separately with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Transfer the output directly into your deployment secret configuration. Never commit it or paste it into tickets, logs or chat. The application does not generate or save these values for you. Environment files are ignored by Git. Back up the root key separately from the database using your normal secure operational process.

Run `npm run db:migrate`, then `npm run dev` (or `npm run build` and `npm start`). Missing/invalid security configuration denies requests; the runtime validator identifies invalid configuration without echoing its value. Database CLI commands and production compilation do not need security keys. No credentials are included in builds.

Keep the first-run instance private until configuration is ready. The setup token prevents an arbitrary visitor from claiming it. Creating the owner, registering the passkey and creating the initial session form one atomic database batch. Failed or cancelled registration creates no owner. Competing registrations cannot create a second owner because the database permits only owner ID 1. Initial setup is permanently closed after success, even if a caller still knows the setup token.

## Authentication and sessions

SimpleWebAuthn performs server verification of challenges, exact origin, RP hash, user presence/verification and assertion signatures. Registration offers ES256 and RS256. Challenges expire after five minutes and are consumed atomically before verification, including unsuccessful attempts. A separate random HttpOnly cookie binds the challenge to the browser. Server tables store hashes of challenge-cookie and session tokens, never the usable tokens. Passkey public keys, IDs, counters and transports are stored; private keys remain with the authenticator.

Sessions are random 256-bit opaque tokens with a fixed twelve-hour lifetime, without sliding renewal. HTTPS cookies use `__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict`, and `Path=/`. Localhost HTTP uses host-only HttpOnly/SameSite cookies without Secure for local testing. Every protected page and credential API request checks server-side session state. Logout deletes the session; the browser token immediately becomes unusable. Authentication rotates an existing browser session. POSTs require an exact Origin match, and JSON bodies where applicable; requests are size-limited to 32 KiB. Security API responses are never cached. Authentication option requests are limited to 30 per minute per instance, stored in the database, with stale challenges/sessions cleaned during authentication. This small global limit can cause temporary denial of service; internet-facing operators should also apply perimeter traffic controls.

## Credential model and encryption

Credentials have independent UUIDs, provider IDs, names, status, default state and timestamps. Names need not be unique. Provider descriptors define input fields; server-only adapters validate structured secret objects and perform verification. Only explicitly labelled local test providers are included: a token provider and a two-field key-pair provider. They accept verification when all values start with `test-valid-`. They do not validate real service accounts or contact external providers.

Secrets use Web Crypto AES-256-GCM with a fresh 96-bit random IV and 128-bit authentication tag per write. The stored JSON envelope is `{v:1,iv,data}`, with base64url-encoded bytes and the authentication tag appended to the ciphertext by Web Crypto. Additional authenticated data binds version, credential ID and provider ID, preventing ciphertext swapping between records. Wrong keys, modified ciphertext and unknown versions fail closed. Encryption is performed before database writes; decryption happens only during server-side verification. Responses use an explicit metadata column list; ciphertext is not returned either.

There is no secret-reveal endpoint. The browser submits secrets only when adding/replacing; fields clear after submission and are never prefilled from saved data. No browser persistence or telemetry is used. Error handling does not log raw provider/SQL exceptions. No application security audit log is implemented yet. Do not configure infrastructure to record request bodies, session cookies, setup tokens or secret environment variables.

Replacement encrypts new input and clears the previous verification status/timestamp. Verification updates only the exact encrypted value it examined, so a concurrent replacement cannot acquire a stale success status. A failed verification records invalid/error state and preserves the last successful verification timestamp of that same payload. A unique partial index allows at most one default per provider; changing default is an atomic batch. Deleting a default leaves no default, without promoting another entry.

Losing the root key permanently prevents decryption of saved secrets. Changing it does not rotate existing data: previous values become unreadable and must be replaced using known source credentials. A full rotation/recovery system is intentionally deferred. Encrypted data at rest does not protect against a compromised running server, stolen root key, or compromised owner browser.

## SQLite and Cloudflare D1

The portable security services use Web Crypto, Web Request/Response APIs and a narrow async query/atomic-batch interface. Node uses SQLite transactions; D1 uses prepared statements and `batch()`. Neither service code nor session logic imports Node filesystem/SQLite APIs. Migration `0002_owner_credentials.sql` adds owner, passkey, session, challenge, rate-limit and credential tables without changing Milestone #1 metadata.

`workers/security.ts` is the Worker entry for the same security API, accepting a `DB` D1 binding and the security configuration as Worker bindings. Supply the root key and setup token through Cloudflare secrets, never plain checked-in vars. Use the platform migration ledger to apply the SQL files in order; do not run the Node migration runner in Workers. D1 queries use the primary binding (no eventually consistent read replica for sessions).

`npm run build:worker` creates `out/security-worker.mjs` without embedding configuration or secrets. A hosting integration should use this module with `nodejs_compat` and compatibility date `2026-07-01` or later, attach its D1 database as `DB`, configure `APP_ORIGIN`/optional `WEBAUTHN_RP_ID`, and supply `CREDENTIAL_ROOT_KEY` and first-run `OWNER_SETUP_TOKEN` as platform secrets. This command only builds the API; it neither provisions resources nor deploys or routes traffic.

The local test harness compiles this actual Worker entry with esbuild and runs it in workerd/Miniflare against local D1. It tests credential CRUD/encryption, constraints and sessions; Chromium also creates and signs real WebAuthn responses verified inside workerd. This is runtime validation of the security API, not a claim that the complete Next.js application has been deployed to Cloudflare. Hosting/connecting the complete Next.js UI on Workers and a production deployment workflow remain separate work. Keep the API on the configured application origin when integrating hosting; no cross-origin cookie/CORS workaround is provided.

Miniflare 4 is used for a stable test harness with patched `sharp` and `undici` overrides. These packages are development-only. Revisit the overrides when the stable harness incorporates the patched dependencies.

## Tests and operational limits

`npm test` includes the SQLite and real workerd/D1 security contracts. `npm run build && npm run test:e2e` runs the complete Node UI journey and WebAuthn API checks in the Worker runtime. Tests use random ephemeral deployment keys, temporary databases and Chromium's virtual authenticator; cryptographic verification and encryption are not mocked. Browser traces are disabled to avoid normalising capture of secret-bearing requests. E2E uses ports 3100/3101 and new ignored `.cache/` databases on each invocation.

No passkey recovery, extra-passkey UI, real provider integration, environment assignment, key rotation, template features or commercial collaboration is included. Protect the owner's passkey and back up the database and encryption key before upgrades. An operator with database and deployment access can alter ownership; this milestone protects normal application flows, not a hostile server administrator.
