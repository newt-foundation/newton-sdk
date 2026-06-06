#!/usr/bin/env bash
set -euo pipefail

# Sync contract ABIs from newton-contracts repository (main branch).
# Usage: ./scripts/sync-abis.sh
#
# Requires: git, forge (Foundry), node
# Source: newton-contracts — Foundry build artifacts under out/<Name>.sol/<Name>.json
#
# newton-contracts does not commit build artifacts (out/ is gitignored), so we
# clone the repo into a tempdir and run `forge build` to produce them.
#
# This script generates three ABI files consumed by the SDK:
#   - src/abis/newtonAbi.ts                 (NewtonProverTaskManager, AttestationValidator)
#   - src/abis/newtonPolicyAbi.ts           (NewtonPolicy)
#   - src/abis/newtonIdentityRegistryAbi.ts (IdentityRegistry)

REPO_URL="https://github.com/newt-foundation/newton-contracts.git"
BRANCH="main"
OUT_DIR="src/abis"

# Format: "SolidityFileName:ExportName:OutFile"
# Forge writes artifacts as out/<SolidityFileName>.sol/<SolidityFileName>.json
# regardless of where the source lives in the repo tree.
ENTRIES=(
  "NewtonProverTaskManager:NewtonProverTaskManagerAbi:newtonAbi.ts"
  "AttestationValidator:AttestationValidatorAbi:newtonAbi.ts"
  "NewtonPolicy:NewtonPolicyAbi:newtonPolicyAbi.ts"
  "IdentityRegistry:IdentityRegistryAbi:newtonIdentityRegistryAbi.ts"
)

command -v forge >/dev/null || { echo "forge not found — install Foundry"; exit 1; }
command -v node >/dev/null  || { echo "node not found"; exit 1; }

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "Cloning $REPO_URL@$BRANCH..."
git clone --depth 1 --branch "$BRANCH" --recurse-submodules --shallow-submodules \
  "$REPO_URL" "$WORKDIR/newton-contracts" >/dev/null 2>&1

pushd "$WORKDIR/newton-contracts" >/dev/null
echo "Building contracts (forge build)..."
forge build --silent
popd >/dev/null

ART_DIR="$WORKDIR/newton-contracts/out"

extract_abi() {
  local contract_name="$1"
  local artifact="$ART_DIR/${contract_name}.sol/${contract_name}.json"
  [[ -f "$artifact" ]] || { echo "missing artifact: $artifact" >&2; exit 1; }
  node -e "
    const fs = require('fs');
    const j = JSON.parse(fs.readFileSync('$artifact', 'utf8'));
    process.stdout.write(JSON.stringify(j.abi, null, 2));
  "
}

# Group entries by output file and emit one file per group.
declare -A FILES
for entry in "${ENTRIES[@]}"; do
  out_file="${entry##*:}"
  FILES["$out_file"]=1
done

for out_file in "${!FILES[@]}"; do
  out_path="$OUT_DIR/$out_file"
  echo "Generating $out_path..."

  cat > "$out_path" << 'HEADER'
// Auto-generated from newton-contracts. DO NOT EDIT.
// Regenerate with: pnpm sync-abis

HEADER

  if [[ "$out_file" == "newtonAbi.ts" ]]; then
    cat >> "$out_path" << 'IMPORTS'
import type { GetContractEventsReturnType } from 'viem'

IMPORTS
  fi

  for entry in "${ENTRIES[@]}"; do
    file="${entry##*:}"
    [[ "$file" == "$out_file" ]] || continue
    name="${entry%%:*}"
    rest="${entry#*:}"
    export_name="${rest%%:*}"
    echo "  Extracting ${name} → ${export_name}"
    abi_json="$(extract_abi "$name")"
    {
      echo "export const ${export_name} = ${abi_json} as const"
      echo ""
    } >> "$out_path"
  done

  if [[ "$out_file" == "newtonAbi.ts" ]]; then
    cat >> "$out_path" << 'FOOTER'
// Derived from the NewtonProverTaskManager ABI so the type stays in lockstep
// with the on-chain event. Do not hand-write — regenerate via `pnpm sync-abis`.
export type TaskRespondedLog = GetContractEventsReturnType<
  typeof NewtonProverTaskManagerAbi,
  'TaskResponded',
  true
>[number]
FOOTER
  fi
done

echo "Done. ABIs written:"
for out_file in "${!FILES[@]}"; do
  echo "  $OUT_DIR/$out_file"
done
echo "Contracts synced: ${#ENTRIES[@]}"
