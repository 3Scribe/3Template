# AGENTS.md

This file contains repository-level instructions for coding agents working on 3T.

## Read before changing code

Before implementing a task:

1. Read `PRODUCT.md`.
2. Read `ARCHITECTURE.md`.
3. Read `TECHNOLOGY.md`.
4. Inspect the existing code and tests before proposing structural changes.
5. Preserve established conventions unless the task explicitly requires changing them.

Do not treat this repository as a blank-slate prototype once implementation has begun.

## Product constraints

3T Community is a **single-owner, self-hosted template management and localisation product**.

For v0.1.0, do not introduce:

- Multi-user organisations.
- Invitations.
- Roles or permission matrices.
- Reviewer accounts.
- Per-language access controls.
- SSO.
- SCIM.
- Managed commercial-only services.

Those belong to a later commercial/cloud edition.

Do not turn 3T into an email-delivery or campaign-management product.

## Architectural invariants

These rules are intentional and should not be changed casually.

### Shared blocks

A template block is either:

- Live-linked to a specific shared block version, or
- Detached/template-local content.

There is no hidden hybrid state.

If a user edits a shared block from a template but chooses not to propagate the change, detach it.

A detached block may retain provenance to the original block and version, but that provenance is informational only.

### Immutability

Published template versions are immutable.

Published block versions are immutable.

Do not mutate historical published content in place.

Restores create new history.

### Deployments

Version creation and deployment are separate operations.

A deployment references a concrete immutable version.

Do not persist an ambiguous "deploy latest" relationship as deployment state.

### Localisation

Localisation is part of the template/content model.

Do not implement translation as an opaque final-export transformation.

### Platform portability

Cloudflare is a supported target, not the product architecture.

Do not place Cloudflare-specific logic inside domain models.

The Community edition must remain viable with Node + SQLite.

## Implementation style

Prefer the smallest maintainable change that satisfies the task.

Avoid:

- Premature generalisation.
- Service/repository layers with no real boundary.
- New frameworks for problems the existing stack already solves.
- Large unrelated refactors inside feature work.
- Clever abstractions that make basic behaviour difficult to trace.

Prefer vertical feature slices and explicit domain behaviour.

## Provider integrations

DeepL is the first translation provider.

Keep provider-specific API details behind a small provider boundary.

Do not scatter DeepL-specific request/response structures throughout the product.

All credentials are secrets.

Never:

- Commit real credentials.
- Log secrets.
- Return secrets to client code.
- Persist secrets in exported project/template artefacts.

## Data changes

When changing persistence:

- Inspect current migrations first.
- Create explicit migrations.
- Consider both SQLite and D1 compatibility.
- Preserve existing data where practical.
- Document destructive or non-reversible changes.
- Add regression coverage for important migration behaviour.

Do not silently reset databases to make development easier unless the task explicitly permits it.

## Tests

Every meaningful behavioural change should have proportionate test coverage.

Prioritise tests for:

- Domain invariants.
- Data integrity.
- Block linking/detachment.
- Version immutability.
- Localisation state.
- Import/export.
- Deployments.
- Regression fixes.

Avoid brittle tests tied to incidental component structure.

Before considering work complete, run the relevant:

- Type check.
- Lint.
- Tests.
- Production build.

If a command cannot be run, state that explicitly in the final summary.

## UI work

Do not perform broad visual redesigns unless requested.

For normal product work:

- Match the existing visual system.
- Preserve accessibility.
- Include loading, empty, success and error states where relevant.
- Make destructive actions explicit.
- Avoid silent failures.
- Keep technical implementation detail out of user-facing copy.

The release goal is a product that a new self-hosting user can understand without developer assistance.

## Documentation

Update documentation when behaviour, configuration, setup or architecture changes.

Do not leave README/setup instructions knowingly stale.

If a design decision is important enough that a future coding agent could easily undo it, update `ARCHITECTURE.md` or this file.

## Scope discipline

Implement the requested milestone or issue.

Do not opportunistically add unrelated features.

When you discover worthwhile follow-up work that is outside scope:

- Do not silently implement it.
- Note it clearly in the completion summary.

## Git and change discipline

Keep changes reviewable.

Prefer logically grouped commits when working in a branch.

Do not rewrite unrelated files solely for formatting.

Do not remove unfamiliar code unless you have established that it is unused and safe to delete.

Do not perform repository-history resets, force pushes or release tagging unless explicitly instructed.

## Completion summary

At the end of a task, report:

- What changed.
- Important implementation decisions.
- Tests/checks run and their results.
- Any migrations or configuration changes.
- Known limitations.
- Follow-up work that is intentionally out of scope.

Be concise but specific.
