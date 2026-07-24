# .github — CI/CD pipeline rules

Scoped rules for GitHub Actions workflows under `.github/workflows/`.

## Security & hygiene

- **Pin third-party actions to a commit SHA** (with a `# vX.Y.Z` comment), not a floating `@v4` or `@main` tag. First-party `actions/*` may use a full version tag but prefer SHA pinning for anything untrusted.
- **Least privilege.** Set an explicit top-level `permissions:` block defaulting to read-only (`contents: read`) and grant more only on the specific job that needs it.
- **Add a `concurrency` group** (e.g. keyed on workflow + ref) with `cancel-in-progress` for PR/push workflows to avoid redundant runs.
- Reference secrets via `secrets.*`; never inline tokens. Guard workflows that use secrets against untrusted `pull_request_target` misuse.

## pnpm + Turborepo

- This is a **pnpm workspace + Turborepo** monorepo. Use `pnpm`, never npm/yarn.
- Enable Corepack (`corepack enable`) or `pnpm/action-setup` with the version pinned to match `package.json`'s `packageManager` field.
- **Cache** the pnpm store (`actions/setup-node` with `cache: pnpm`) and Turbo's cache. Let Turbo's task graph drive builds — run root scripts (`pnpm build`, `pnpm lint`, `pnpm check-types`) so tasks fan out across workspaces rather than hand-listing apps.
- Use `--frozen-lockfile` on install in CI.

## Structure

- One workflow per concern (CI, deploy, etc.), clearly named.
- Fail fast: run `lint`, `check-types`, and tests as required checks on PRs.
