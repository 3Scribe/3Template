# 3T Technology

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
