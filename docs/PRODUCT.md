# 3T Product Definition

## Purpose

3T is an open-source template management and localisation platform for teams that need structured, reusable content rather than isolated files.

The product should make it easy to build templates from reusable blocks, localise them, test them with realistic data, version them safely and deploy known versions to target environments.

The Community edition is designed to be genuinely useful as a self-hosted single-owner product.

## Core concepts

### Projects

A project is the top-level working container for related templates, assets, localisation settings, test data and deployment targets.

### Templates

A template is a versioned composition of blocks and template-local content.

Templates may include:

- Shared reusable blocks.
- Blocks created directly inside the template.
- Custom HTML or equivalent template-local content.
- Localised variants.
- Metadata needed for export and deployment.

### Blocks

Blocks are reusable versioned pieces of template content.

A template may reference a shared block version. When a user edits a referenced block, the product must make the consequences explicit.

There are two important outcomes:

1. The shared block is updated and dependent templates can adopt the new version.
2. The template keeps the local edit, at which point the block becomes detached and behaves as template-local content.

A detached block keeps provenance information about where it originally came from, but it no longer has a live dependency on that shared block.

### Localisation

Localisation is part of the template model, not a bolt-on export step.

The initial translation provider is DeepL, using BYOK credentials.

The provider abstraction should remain clean enough to support additional providers later without redesigning the product.

### Media

Projects need managed media/assets so templates do not depend on unmanaged external files.

### Test data

Users should be able to define named test-data profiles containing key/value pairs for placeholders.

These profiles allow templates to be previewed and validated against realistic sample data.

### Versions and revisions

Changes must be traceable.

Published versions are immutable.

Editing after publication creates a new working revision/version rather than mutating a published artefact in place.

Users should be able to inspect revision history and restore earlier states.

### Deployments

A deployment records that a specific immutable version was deployed to a specific environment.

Deployment must remain separate from version creation.

An environment should point to an explicit version rather than an ambiguous "latest" state.

## v0.1.0 scope

The first public version should provide a complete single-owner workflow:

- Single-user authentication.
- Project management.
- Template creation and editing.
- Reusable shared blocks.
- Clear linked-versus-detached block behaviour.
- Localisation and translate-missing workflow.
- DeepL BYOK key management.
- Review of translated content.
- Import.
- Export.
- Search and filtering.
- Revision history.
- Audit trail.
- Restore.
- Media management.
- Test-data profiles.
- Deployments.
- Settings.
- Local Node/SQLite support.
- Cloudflare/D1 support.
- UI polished enough for a complete stranger to use without developer assistance.

## Explicitly out of scope for Community v0.1.0

The following belong to the later commercial/cloud product:

- Multi-user organisations.
- Team invitations.
- Roles and permissions.
- Reviewer-only roles.
- Per-language access control.
- Enterprise identity.
- SSO.
- SCIM.
- Managed commercial infrastructure.

The Community edition should not contain dormant enterprise complexity merely to anticipate those features.

## Product boundaries

3T is a template management and localisation product.

It is **not** intended to become:

- An email delivery platform.
- A campaign manager.
- A general-purpose CMS.
- A translation management system for arbitrary document formats.
- A workflow engine.

Integrations may exist around those concerns, but the core product should stay focused.

## Open-source and commercial boundary

The Community edition should remain useful, self-hosted and deployable on its own.

The commercial/cloud edition should build on shared upstream/core capabilities rather than becoming a permanently divergent fork.

Open-source architecture should not be deliberately crippled to force commercial adoption.

Commercial value should come from managed hosting, collaboration, organisation features, enterprise identity, administration and operational convenience.

## Release gate

Before the repository is treated as the public v0.1.0 baseline:

- The primary workflow must work end to end.
- The UI should be near-finished rather than merely functional.
- A new user should be able to install, configure and use the Community edition independently.
- No private/internal assumptions should remain in the repository.
- Setup and deployment instructions must be accurate.
- The codebase should be clean enough to justify resetting/rebasing public repository history if desired.
