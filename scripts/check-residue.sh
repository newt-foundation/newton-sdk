#!/usr/bin/env bash
# Fails (exit 1) if any live Mintlify residue remains in tracked files.
# Excludes immutable history (CHANGELOG.md), the migration/design docs, and the lockfile.
set -euo pipefail

git grep -niE "mintlify|mint\.json|\.mintignore" -- \
  ':(exclude)CHANGELOG.md' \
  ':(exclude)docs/migrations/' \
  ':(exclude)pnpm-lock.yaml' \
  && matched=1 || rc=$?

# git grep: 0 = matches found (FAIL), 1 = no matches (PASS), >1 = error.
if [ "${matched:-0}" = "1" ]; then
  echo "residue check: FAIL — Mintlify references found above." >&2
  exit 1
fi
if [ "${rc:-1}" != "1" ]; then
  echo "residue check: ERROR — git grep exited ${rc}." >&2
  exit "${rc}"
fi
echo "residue check: PASS — no live Mintlify residue."
