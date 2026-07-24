#!/usr/bin/env bash
#
# Start a new feature on a fresh branch off the latest origin/main.
#   pnpm feature <type>/<description>        e.g. pnpm feature feat/artist-gallery
#
# Fetches origin/main, then creates the branch from it — so you never build on a
# stale main. Any uncommitted working changes come along to the new branch.
set -euo pipefail

branch="${1:-}"

if [ -z "$branch" ]; then
  echo "usage: pnpm feature <type>/<description>   (e.g. feat/artist-gallery)" >&2
  exit 1
fi

# Soft-check the repo's branch convention: type/kebab-description.
if ! printf '%s' "$branch" | grep -Eq '^(feat|fix|chore|refactor|test|docs|ci|build)/[a-z0-9][a-z0-9._/-]*$'; then
  echo "warning: '$branch' doesn't match <type>/<description>" >&2
  echo "         types: feat|fix|chore|refactor|test|docs|ci|build" >&2
  printf 'Create it anyway? [y/N] ' >&2
  read -r reply
  case "$reply" in
    [yY] | [yY][eE][sS]) ;;
    *) echo "aborted." >&2; exit 1 ;;
  esac
fi

if git show-ref --verify --quiet "refs/heads/$branch"; then
  echo "error: branch '$branch' already exists — pick another name or switch to it." >&2
  exit 1
fi

echo "Fetching latest origin/main…"
git fetch origin main

echo "Creating '$branch' from origin/main…"
git switch -c "$branch" origin/main

echo "✓ On '$branch' (based on latest origin/main). Commit away."
