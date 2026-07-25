# CLAUDE.md

Guidance for working in this repository.

## Project

**Inksana** — website for a tattoo studio. A Vue 3 single-page application backed by a Strapi headless CMS, in a Turborepo monorepo.

The repo was bootstrapped from the `create-turbo` (Next.js) template and is being migrated to the stack below. Expect leftover template files (`apps/docs`, `packages/*`, Next.js configs) to disappear as the migration completes — don't build on them.

## Stack

- **Frontend (`apps/web`)**: Vue 3 (`<script setup>` SFCs), Vite, Vue Router, Pinia, Tailwind CSS, WebGL2.
- **CMS (`apps/cms`)**: Strapi 5 (TypeScript), SQLite via `better-sqlite3` for local dev.
- **Monorepo**: Turborepo + pnpm workspaces (`apps/*`, `packages/*`). pnpm is the package manager — do not use npm/yarn.
- **Tooling**: oxlint + ESLint for linting, Prettier for formatting, Vitest + Vue Test Utils for tests, `vue-tsc` for type-checking.

## Layout

```
apps/
  web/    Vue 3 SPA (Vite)
  cms/    Strapi 5 CMS
packages/ shared config/UI (legacy template packages being removed)
turbo.json, pnpm-workspace.yaml   monorepo config
```

`apps/web/src`: `main.ts` (entry), `App.vue`, `router/`, `stores/` (Pinia), `composables/`. Tests are colocated as `*.spec.ts` next to their subject (the legacy `__tests__/` is being phased out). The `@` alias resolves to `apps/web/src`.

## Commands

Run from the repo root unless noted. Turbo fans tasks out across workspaces.

- `pnpm dev` — start all apps in dev (Vite for web, `strapi develop` for cms).
- `pnpm build` — build all apps.
- `pnpm lint` — lint all apps.
- `pnpm format` — Prettier across the repo.
- `pnpm check-types` — type-check all apps.

Per-app (run in `apps/web`):

- `pnpm dev` / `pnpm build` / `pnpm preview`
- `pnpm test:unit` — Vitest.
- `pnpm type-check` — `vue-tsc`.
- `pnpm lint` — runs `oxlint --fix` then `eslint --fix`.

CMS (run in `apps/cms`): `pnpm dev` (`strapi develop`), `pnpm build`, `pnpm start`.

## Conventions

- **Formatting** (`apps/web/.prettierrc.json`): no semicolons, single quotes, `printWidth` 100. Run Prettier rather than hand-formatting.
- **Linting**: oxlint is the first pass (`correctness` category as errors, Vue/TS/Vitest/unicorn plugins), ESLint second. Keep both clean.
- **Vue**: prefer `<script setup lang="ts">` SFCs. State goes in Pinia stores under `src/stores/`; routes under `src/router/`.
- **TypeScript** throughout the web app.

## CMS integration

The web app consumes Strapi over its **REST API** (`/api/*`). Point the frontend at the Strapi base URL via an env var (`VITE_`-prefixed for Vite to expose it). Strapi content types live in `apps/cms/src/api`.

## WebGL2

Used for two things, written by default as **raw WebGL2** (no wrapper):

1. Background / hero visual effects.
2. Design & AR previews — rendering and warping tattoo designs onto photos.

Keep GL code isolated behind composables/modules; manage context, programs, and buffers explicitly and dispose of them on unmount. Assume WebGL2 (not WebGL1) features are available.

**three.js is permitted** where raw WebGL2 would be disproportionate effort — chiefly loading and rendering glTF/GLB meshes (e.g. the `/home3` logo-badge hero uses `three` + `GLTFLoader`). It lives in the `apps/web` workspace. Still isolate it behind a composable/module and dispose of every three resource (geometries, materials, renderer) on unmount, exactly as for raw GL. Prefer raw WebGL2 for shader-only / fullscreen-effect work where three adds no leverage.

## Tailwind CSS

Tailwind v4 is wired into `apps/web` via the `@tailwindcss/vite` plugin (see `vite.config.ts`). It uses CSS-first config: `src/assets/main.css` holds `@import 'tailwindcss'`, imported from `src/main.ts`. Customize the theme with `@theme` directives in that CSS file — there is no `tailwind.config.js`.

## Git & commits

- **Conventional Commits.** `type(scope): subject` — e.g. `feat(web): add artist gallery`, `fix(cms): populate portfolio media`. Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `ci`, `build`.
- **Imperative, concise subjects** (~72 chars, no trailing period). The body explains *why*, not *what*.
- **Branch names:** `type/short-description` (e.g. `feat/artist-gallery`, `fix/preview-context-leak`).
- **No AI attribution** in commit messages or PR bodies — omit `Co-Authored-By` / "Generated with Claude Code" trailers.

## Scoped rules

Domain-specific rules live in nested `CLAUDE.md` files, auto-loaded when working in their directory:

- `apps/web/CLAUDE.md` — Vue, TypeScript, styling, testing, WebGL2.
- `apps/cms/CLAUDE.md` — Strapi content types & API.
- `.github/CLAUDE.md` — GitHub Actions pipelines.

## Notes

- When adding a tool or dependency, add it to the correct workspace, not the repo root, unless it's genuinely repo-wide.
