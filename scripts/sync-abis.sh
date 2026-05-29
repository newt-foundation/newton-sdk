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

REPO_URL="https://github.com/newt-foundation/newton-contracts.git"
BRANCH="main"
OUT_DIR="src/abis"

# Newton core contracts to sync.
# Format: "SolidityFileName:ExportName"
# Forge writes artifacts as out/<SolidityFileName>.sol/<SolidityFileName>.json
# regardless of where the source lives in the repo tree.
CONTRACTS=(
  "NewtonProverTaskManager:NewtonProverTaskManagerAbi"
  "AttestationValidator:AttestationValidatorAbi"
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

declare -A ABIS
for entry in "${CONTRACTS[@]}"; do
  name="${entry%%:*}"
  echo "  Extracting ${name}..."
  ABIS["$entry"]=$(extract_abi "$name")
done

cat > "$OUT_DIR/newtonAbi.ts" << 'HEADER'
// Auto-generated from newton-contracts. DO NOT EDIT.
// Regenerate with: pnpm sync-abis

import type { Address, Hex, Log } from 'viem'

HEADER

for entry in "${CONTRACTS[@]}"; do
  export_name="${entry##*:}"
  echo "export const ${export_name} = ${ABIS["$entry"]} as const" >> "$OUT_DIR/newtonAbi.ts"
  echo "" >> "$OUT_DIR/newtonAbi.ts"
done

# Append convenience type re-exports
cat >> "$OUT_DIR/newtonAbi.ts" << 'FOOTER'
export type TaskRespondedLog = Log & {
  args: {
    taskResponse: {
      taskId: Hex;
      policyClient: Address;
      policyId: Hex;
      policyAddress: Address;
      intent: {
        from: Address;
        to: Address;
        value: string; // string representation of big int
        data: Hex;
        chainId: string; // string representation of big int
        functionSignature: Hex;
      };
      intentSignature: Hex;
      evaluationResult: Hex;
    };
    responseCertificate: {
      taskResponsedBlock: string;
      responseExpireBlock: string;
      hashOfNonSigners: Hex;
    };
  };
};
FOOTER

echo "Done. ABIs written to $OUT_DIR/newtonAbi.ts"
echo "Contracts synced: ${#CONTRACTS[@]}"
