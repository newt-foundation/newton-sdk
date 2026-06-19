#!/usr/bin/env bash
set -euo pipefail

# Sync deployment artifacts from newton-contracts repository (main branch).
# Usage: ./scripts/sync-deployments.sh
#
# Requires: git, node
# Source: newton-contracts — production JSON under deployments/newton-prover
# and deployments/newton-cross-chain only.
#
# This script copies those prod deployment files into src/deployments/ and
# generates manifest.ts so every JSON file can be imported from TypeScript.

REPO_URL="https://github.com/newt-foundation/newton-contracts.git"
BRANCH="main"
OUT_DIR="src/deployments"
SYNC_DIRS=(newton-prover newton-cross-chain)

command -v git >/dev/null || { echo "git not found"; exit 1; }
command -v node >/dev/null || { echo "node not found"; exit 1; }

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "Cloning $REPO_URL@$BRANCH..."
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$WORKDIR/newton-contracts" >/dev/null 2>&1

SRC_DIR="$WORKDIR/newton-contracts/deployments"
[[ -d "$SRC_DIR" ]] || { echo "missing deployments directory in newton-contracts" >&2; exit 1; }

rm -rf "$OUT_DIR"/core "$OUT_DIR"/newton-cross-chain "$OUT_DIR"/newton-prover "$OUT_DIR"/policy
rm -f "$OUT_DIR"/manifest.ts
mkdir -p "$OUT_DIR"

for dir in "${SYNC_DIRS[@]}"; do
  src="$SRC_DIR/$dir"
  [[ -d "$src" ]] || { echo "missing deployments/$dir in newton-contracts" >&2; exit 1; }
  mkdir -p "$OUT_DIR/$dir"
  find "$src" -maxdepth 1 -type f -name '*-prod.json' -exec cp {} "$OUT_DIR/$dir/" \;
done

OUT_DIR="$OUT_DIR" node <<'NODE'
const fs = require('fs')
const path = require('path')

const outDir = process.env.OUT_DIR
if (!outDir) {
  console.error('OUT_DIR is required')
  process.exit(1)
}
const jsonFiles = []

function walk(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, rel)
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      jsonFiles.push(rel)
    }
  }
}

walk(outDir)
jsonFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

const toIdentifier = (relPath) =>
  relPath
    .replace(/\.json$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^(\d)/, '_$1')

const imports = jsonFiles
  .map((rel) => {
    const id = toIdentifier(rel)
    return `import ${id} from './${rel}'`
  })
  .join('\n')

const entries = jsonFiles
  .map((rel) => {
    const id = toIdentifier(rel)
    const key = rel.replace(/\.json$/, '')
    return `  '${key}': ${id},`
  })
  .join('\n')

const manifest = `// Auto-generated from newton-contracts. DO NOT EDIT.
// Regenerate with: pnpm sync-deployments

${imports}

export const DEPLOYMENTS = {
${entries}
} as const

export type DeploymentKey = keyof typeof DEPLOYMENTS
`

fs.writeFileSync(path.join(outDir, 'manifest.ts'), manifest)

console.log(`Generated manifest.ts with ${jsonFiles.length} deployment files`)
NODE

echo "Done. Deployments written to $OUT_DIR/"
