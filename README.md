# 3T

3T is an open-source, self-hosted template management and localisation platform.

It is intended to make reusable templates, shared blocks, localisation, test data and deployments manageable without tying the core product to a specific cloud provider or proprietary service.

## Project status

3T is at the initial scaffolding stage.

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
