# 3Template Architecture

## Architectural goals

3Template should favour a small, portable core with explicit domain boundaries.

The architecture should:

- Work locally with Node and SQLite.
- Support Cloudflare Workers and D1.
- Avoid hard coupling to one cloud provider.
- Keep storage and provider integrations behind clear boundaries.
- Preserve provenance and version history.
- Make destructive or irreversible state changes explicit.
- Keep Community concerns separate from future Cloud-only concerns.

## Domain model

The exact schema may evolve, but the conceptual model should remain stable.

### Project

Represents a workspace for related templates and resources.

Typical responsibilities:

- Project metadata.
- Templates.
- Shared blocks.
- Locales/languages.
- Media.
- Test-data profiles.
- Deployment targets.
- Provider/configuration references.

### Template

Represents a logical template.

A template has metadata and a history of revisions/versions.

A template does not directly represent "whatever is currently deployed".

### TemplateVersion

Represents an immutable published snapshot of a template.

A version contains an ordered set of template content entries/block instances and the exact references or detached content needed to reproduce the template.

Published versions must never be mutated in place.

### Block

Represents a reusable logical block.

Examples might include:

- Header.
- Footer.
- Button group.
- Legal section.
- Product card.
- Shared HTML fragment.

### BlockVersion

Represents an immutable version of a shared block.

Templates that depend on shared content should reference a specific block version rather than an unversioned mutable object.

### Template block entry

A template contains an ordered collection of entries.

An entry can be:

- A live reference to a shared block version.
- A block created directly in the template.
- Detached custom/template-local content.

A live reference and detached content are mutually exclusive states.

### Provenance

When a referenced block is detached, retain informational provenance such as:

- Original block ID.
- Original block version ID.
- Detachment timestamp.
- Optional reason or originating action.

Provenance is historical information only. It must not create a hidden live dependency.

### Localisation

Localisation belongs to the versioned content model.

Localised values should be addressable by locale and content identity rather than copied into opaque export blobs.

The model should support:

- Source locale.
- Target locales.
- Missing-translation detection.
- Review state.
- Translation provenance/provider metadata where useful.
- Re-translation without destroying reviewed historical versions.

### Media

Media belongs to a project-level managed collection.

Template versions should reference stable media identities rather than arbitrary developer-machine paths.

Storage implementation should remain replaceable.

### TestDataProfile

A named set of key/value data used for previewing and validating templates.

A profile should be project-scoped and should not be baked into immutable template content.

### DeploymentEnvironment

Represents a named target such as:

- Development.
- Staging.
- Production.

Environment identity is separate from a template version.

### Deployment

Represents the deployment of a specific immutable template version to a specific environment.

A deployment should retain enough metadata for auditability, including:

- Environment.
- Template version.
- Timestamp.
- Status.
- Adapter/provider metadata where appropriate.

## Block editing rules

### Updating a shared block

Editing a shared block creates a new block version.

Existing template versions remain unchanged.

Draft templates may explicitly adopt the newer version.

### Editing a shared block from inside a template

The UI must make the user's intention explicit.

If the user chooses to propagate the change:

- Update the shared block through the normal block-version workflow.
- The template may then adopt the new block version.

If the user chooses not to propagate the change:

- Break the live block relationship.
- Convert the content to template-local/detached content.
- Retain provenance to the original shared block/version.

There must not be an implicit state where content looks local but still changes when the shared block changes.

## Versioning rules

- Published template versions are immutable.
- Published block versions are immutable.
- Restoring an old state should create a new working revision rather than rewriting history.
- Deployment records reference immutable versions.
- "Latest" may be a UI convenience, but persisted deployment state should resolve to a concrete version.

## Persistence boundaries

Domain logic should not depend directly on SQLite- or D1-specific behaviour.

Use repository/storage abstractions only where they provide a real portability boundary; avoid unnecessary abstraction layers that merely rename ORM calls.

Schema and migrations must work predictably across supported persistence targets.

Local Node SQLite connections and migration execution stay in `src/server/db/`, with portable schema SQL in `migrations/`. Migration execution is an explicit operator command, never a request side effect. The D1 adapter uses prepared statements and atomic batches. Services depend on the narrow query/batch interface; Node interactive transactions never leak into D1 service logic.

### Owner authentication and credentials

The Community owner is a singleton enforced by a database constraint. Setup requires deployment authorisation and commits owner/passkey/session creation atomically after server-side WebAuthn verification. Never persist a half-created owner or add a password fallback. Challenges are consumed once; session tokens are opaque and stored only as hashes, with server-side expiry and revocation checks.

Credential IDs are independent of provider IDs. Multiple named entries may share a provider; only one can be its default. Secrets are versioned AES-GCM envelopes bound to the record and provider, with the root key supplied by deployment configuration. Only allowlisted metadata reaches clients. There is no reveal operation; replacement resets verification, and verification updates are conditional on the payload it checked. Provider schemas/verification belong behind a small server-only adapter. See [security implementation and operating rules](./SECURITY.md).

## Translation provider boundary

DeepL is the first supported provider.

Provider-specific API details should remain behind a translation-provider contract.

The core workflow should reason in terms of:

- Translation request.
- Source locale.
- Target locale.
- Source text/content identity.
- Result.
- Provider error/status.

Do not scatter DeepL-specific assumptions throughout UI and domain code.

## Deployment boundary

Deployment targets should use adapters.

Core product code should decide _what_ version is being deployed.

Adapters should decide _how_ that immutable version is delivered to a target platform.

Do not couple the version model to Cloudflare.

## Community versus Cloud architecture

Community is single-owner and self-hosted.

Do not introduce organisation membership, tenancy checks or enterprise role logic into the Community domain before they are needed.

Future Cloud capabilities should layer collaboration and managed services around shared product/core concepts.

The preferred direction is shared upstream/core code with edition-specific capabilities, not two independently evolving forks.

## Testing strategy

Prefer tests around observable behaviour and domain invariants.

High-value tests include:

- Shared block update does not mutate old versions.
- Detaching a block removes the live dependency.
- Provenance survives detachment.
- Published versions remain immutable.
- Restore creates new history.
- Missing translations are detected correctly.
- Deployment references a concrete immutable version.
- Storage adapters behave consistently across supported environments.
- Import/export round-trips preserve intended content.

Avoid excessive tests that are tightly coupled to component internals or incidental implementation details.
