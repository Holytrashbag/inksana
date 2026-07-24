# apps/cms — Strapi rules

Scoped rules for the Strapi 5 CMS. Extends the root `CLAUDE.md`.

## General

- Strapi 5, TypeScript. SQLite via `better-sqlite3` for local dev — don't assume Postgres-only features.
- Content types live in `src/api/<name>/`. Keep the generated structure: `content-types/`, `controllers/`, `routes/`, `services/`.
- Prefer Strapi's generators/config-driven approach over hand-editing generated boilerplate where possible.

## Content types & API

- The web app consumes Strapi over the **REST API** (`/api/*`). Design schemas and populate rules with that consumer in mind.
- **Name fields to survive the boundary:** the frontend normalizes Strapi's response shape, so keep field names stable and descriptive. Document breaking schema changes.
- Relations and media that the frontend needs must be **populated explicitly** (populate config / `populate` params) — Strapi 5 does not deep-populate by default. Verify the REST response actually contains nested data.
- Set **permissions deliberately.** Public read where the site needs it; never expose write/admin routes publicly. Note required permission changes when adding a public collection.

## Conventions

- Follow the root formatting/linting rules (no semicolons, single quotes, `printWidth` 100).
- Custom endpoints go through the standard controller → service → route flow; put reusable logic in services, not controllers.
- Keep secrets in env vars, never committed. Local `.env` stays untracked.
