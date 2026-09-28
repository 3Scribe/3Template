# 3Template Technology

## Principles

Technology choices should support:

- A strong local development experience.
- Self-hosting without unnecessary infrastructure.
- Cloudflare deployment.
- Portability beyond Cloudflare.
- Straightforward testing.
- Minimal operational burden.
- Clear separation between product logic and provider/platform details.

Avoid introducing infrastructure merely because it may be useful in a future commercial edition.

## Application stack

### Application framework

Use **Next.js** as the full-stack application framework.

The application should keep server-only concerns clearly separated from client/editor concerns.

### Front end

Use:

- React.
- TypeScript.

Prefer established, accessible UI patterns and a small component surface over unnecessary design-system complexity.

### Persistence

Initial targets:

- SQLite for local/self-hosted installations.
- Cloudflare D1 for Cloudflare deployments.

Use Prisma only where it remains compatible with the actual runtime/deployment targets chosen by the implementation.

Do not make domain logic depend on SQLite-specific behaviour.

### Authentication

Community v0.1.0 is single-owner.

Authentication should be simple and appropriate for a self-hosted single-user product.

Do not add organisations, membership tables, role matrices, SSO or SCIM to the Community schema merely for future-proofing.

### Translation

Initial provider:

- DeepL.

Credentials are BYOK.

Secrets must be handled server-side and must never be embedded in client bundles, logs or exported project data.

The provider integration must sit behind a small translation-provider boundary so other providers can be added later.

### Media storage

Media storage should use a replaceable adapter.

Local/self-hosted and Cloudflare implementations may differ, but template/domain code should work against stable media identities rather than storage-specific paths.

### Deployment adapters

Deployment logic should use platform adapters.

Cloudflare is an initial deployment target, not an architectural dependency.

Future deployment targets should be addable without changing the template/version domain model.

## Code organisation

Prefer vertical slices where practical.

A feature should keep its UI, server behaviour, validation and tests close enough to understand as one unit.

Shared abstractions should be introduced only after a genuine common boundary is visible.

Suggested top-level conceptual areas:

- Projects.
- Templates.
- Blocks.
- Localisation.
- Media.
- Test data.
- Versions/revisions.
- Deployments.
- Settings/providers.
- Authentication.

Exact directories should follow the framework conventions and should not be forced to mirror this list mechanically.

## Validation

Validate external input at boundaries.

Examples:

- API requests.
- Imports.
- Environment configuration.
- Provider responses where assumptions matter.
- Deployment configuration.

Do not duplicate the same validation rules independently across client, server and persistence layers without a reason.

## Migrations

Database migrations are part of the product.

Every schema change should be:

- Explicit.
- Reproducible.
- Safe for existing Community installations where possible.
- Tested against supported persistence targets.

Destructive migrations require clear documentation.

## Configuration

Use environment variables or platform secret/configuration facilities for instance-level configuration.

Do not commit:

- API keys.
- Real credentials.
- Private endpoints.
- Developer-specific machine paths.
- Production secrets.

Provide `.env.example` or equivalent documentation with safe placeholder values.

## Testing

Use a layered strategy:

- Fast unit tests for domain invariants and pure logic.
- Integration tests for persistence/provider boundaries.
- End-to-end tests for the critical user journey.
- Behavioural regression tests for bugs that previously escaped.

Do not optimise for test count.

Optimise for confidence in the behaviours that would be expensive to break.

## CI expectations

CI should eventually verify at least:

- Install succeeds.
- Type checking.
- Linting.
- Unit/integration tests.
- Production build.
- Migration validity where practical.

Keep CI reproducible and free from hidden developer-machine state.

## Supported deployment philosophy

The initial supported deployment paths are:

1. Local/self-hosted Node + SQLite.
2. Cloudflare + D1.

The architecture should not assume these will be the only targets.

Multi-cloud deployment buttons/templates are a later milestone and should not be prematurely implemented as part of initial scaffolding.

## Milestone #1 implementation

- Next.js 16 App Router, React 19 and strict TypeScript. System fonts and plain CSS keep the shell small and builds independent of font downloads.
- Node 24.15+ (24.x), using built-in `node:sqlite` for local storage. This API may emit Node's experimental warning on the pinned runtime. No ORM is necessary for the one metadata table; revisit a query layer when real product queries justify it.
- `src/server/db/sqlite.ts` is the Node-only connection boundary. Server runtime entry points import `server-only`; CLI/tests enable the `react-server` export condition so they can exercise those same modules. Pure configuration validation has no runtime imports so Next configuration can validate it early.
- `DATABASE_PATH` is a local file path, not a database URL. No `NEXT_PUBLIC_*` configuration or credentials exist. Do not pass server configuration to client components.
- ESLint, Prettier, Node's test runner through `tsx`, and Playwright Chromium provide the quality baseline. The npm lockfile fixes dependency resolution; CI uses `npm ci`.

### Local migrations

`migrations/0001_instance.sql` introduces only `instance_metadata` and a scaffold-version marker. It contains no product schema or secrets. The runner separately maintains `_migrations` with checksums.

To change schema, add the next ordered `NNNN_description.sql` file. Do not edit applied migrations. SQL files must not contain transaction control or operations such as `VACUUM` that cannot run inside a transaction. The local runner applies pending files and their ledger entries together in an immediate transaction; a failure rolls back the entire batch. Missing, modified, or out-of-order history is rejected. Checksums normalise CRLF to LF for Windows/Linux portability. Back up an existing installation before applying future schema changes; destructive changes need an explicit upgrade note. The initial migration is additive and has no configuration beyond the database path.

Run migrations separately from application startup. Requests open the existing database read-only for the scaffold check; the smoke command demonstrates a parameterised write/read and rolls it back. Later write features should open writable connections explicitly and define their own transaction boundaries.

### Cloudflare readiness and limits

The SQL schema uses ordinary SQLite tables and statements suitable for D1, but D1 execution has not been verified in this milestone. Neither Node's file-backed SQLite driver nor the filesystem/transaction-based local migration runner should be bundled into a Worker. A future D1 adapter must use a Worker binding and D1's migration/batch facilities, with integration coverage for its transaction semantics. The dashboard's instance check is the small integration point to replace when that target is implemented; there are no Node dependencies in product/domain models.

Cloudflare hosting also needs a compatible Next.js runtime adapter and a production `workerd` test. Select and pin that adapter against the framework version at the deployment milestone; a successful Node build does not prove Worker compatibility. See the official [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) and [D1 documentation](https://developers.cloudflare.com/d1/). No Cloudflare deployment configuration or deployment workflow is added here.

## Milestone #2 implementation

SimpleWebAuthn handles passkey ceremonies; Web Crypto provides AES-256-GCM and token hashing on Node and Workers. No ORM or authentication framework is added. `src/server/db/port.ts` captures the real SQLite/D1 query and atomic-batch boundary. The Worker security API and Node routes call the same server-only services. Milestone #1's D1 deferral above is superseded for this security slice: local workerd/D1 tests now exercise it, while full Next.js hosting on Workers remains separate deployment work.

Read [SECURITY.md](./SECURITY.md) for required root-key/origin/setup-token configuration, migration details, session decisions, no-reveal rules, test-provider semantics and operational limitations. Product/project schema remains deferred.
