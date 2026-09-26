# 3T

3T is an open-source, self-hosted template management and localisation platform.

It is intended to make reusable templates, shared blocks, localisation, test data and deployments manageable without tying the core product to a specific cloud provider or proprietary service.

## Project status

Milestone #1 provides a working application shell, local SQLite migrations, and automated checks. Product workflows and authentication are not implemented yet.

## Local development

Use **Node 24.15+ (24.x)** and **npm 11+**. `.nvmrc` pins the CI runtime.

```sh
npm ci
cp .env.example .env.local
npm run db:migrate
npm run db:smoke
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`.
Open [localhost:3000](http://localhost:3000). Both development and production servers bind to loopback by default. This scaffold has no authentication; keep it local until the authentication milestone.

`DATABASE_PATH` is server-only and defaults to `./data/3t.sqlite`. Relative paths resolve from the repository root; absolute local file paths are also accepted. No credentials are required. Next and the database scripts load `.env.local` using Next's environment loader. Environment files and SQLite files are ignored by Git. Run database commands from the repository root.

Migrations run explicitly, never during a request or build. A missing or unmigrated database prevents the dashboard from loading; run `npm run db:migrate` before starting the app. Invalid path configuration fails with a clear configuration error without echoing its value. The local database directory must be writable by the server operator.

## Contributor commands

| Command                                   | Purpose                                                    |
| ----------------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                             | Start the local development server                         |
| `npm run db:migrate`                      | Create the database and apply pending migrations           |
| `npm run db:smoke`                        | Verify database writes and reads, then roll back test data |
| `npm run typecheck`                       | Generate Next route types and check TypeScript             |
| `npm run lint`                            | Run ESLint                                                 |
| `npm run format` / `npm run format:check` | Format / check formatting                                  |
| `npm test`                                | Run configuration and persistence tests                    |
| `npm run build`                           | Create the production build; no database required          |
| `npm start`                               | Serve the production build after migrating the database    |
| `npm run test:e2e`                        | Run Chromium smoke tests against the production build      |

Before the first browser test run, run `npx playwright install chromium` (on Linux, use `--with-deps`). Run `npm run build` before `npm run test:e2e`. Browser tests initialise their own database in ignored `.cache/` and use port 3100. Unit/integration tests use temporary databases and do not touch your local development data. CI runs all the checks above, including production browser smoke tests; extend these tests as working product journeys arrive.

## Repository structure

- `src/app/`: App Router layout, dashboard, loading and error pages, global styles.
- `src/server/`: server configuration and the Node SQLite persistence boundary.
- `migrations/`: ordered SQL schema changes.
- `scripts/`: explicit local database migration and smoke commands.
- `tests/`: configuration and migration/persistence regression tests.
- `e2e/`: production application browser smoke tests.
- `docs/`: product and architectural decisions.

Add future features as vertical slices when implemented; this scaffold deliberately has no speculative feature directories or schema. See [technology decisions](./docs/TECHNOLOGY.md#milestone-1-implementation) for migration authoring and Cloudflare constraints.

## Planned v0.1.0 scope

The first public milestone is **v0.1.0**, focused on a complete single-owner, self-hosted workflow with:

- Single-user authentication.
- Template and project management.
- Reusable blocks/components.
- Localisation.
- DeepL as the initial translation provider, using BYOK credentials.
- Import and export.
- Revisions, audit history and restore.
- Search and filtering.
- Test-data profiles.
- Media management.
- Deployments.
- A local Node/SQLite deployment path.
- A Cloudflare/D1 deployment path.

Multi-user organisations, invitations, roles, reviewer permissions, language-level access, SSO and SCIM are intentionally reserved for a later commercial/cloud edition.

## Core design principles

- The open-source Community edition must stand on its own.
- The core should remain portable and provider-neutral.
- Shared blocks may be linked or detached, but never ambiguously half-linked.
- Published versions are immutable.
- Deployment is separate from version creation.
- Provenance should be retained even after content is detached.
- Configuration and BYOK credentials must remain cleanly separated from managed commercial services.
- Behavioural regression tests are preferred over brittle implementation-specific tests.
- Avoid architecture that only works on one hosting platform.

## Licence

3T is licensed under the **GNU Affero General Public License v3.0**.

See the repository `LICENSE` file for the full licence text.

## Repository documentation

- [`PRODUCT.md`](./docs/PRODUCT.md) — product scope and direction.
- [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — domain model and architectural rules.
- [`TECHNOLOGY.md`](./docs/TECHNOLOGY.md) — technology choices and constraints.
- [`AGENTS.md`](./AGENTS.md) — instructions for coding agents working in this repository.
