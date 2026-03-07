#!/usr/bin/env bash
set -euo pipefail

# Sync contract ABIs from newton-prover-avs repository (main branch)
# Usage: ./scripts/sync-abis.sh
#
# Requires: gh CLI authenticated with access to newt-foundation org
# Source: newton-prover-avs/contracts/out/ (Foundry build artifacts)

REPO="newt-foundation/newton-prover-avs"
BRANCH="main"
OUT_DIR="src/abis"

# Newton core contracts to sync.
# Format: "SolidityFileName:ExportName"
# SolidityFileName maps to contracts/out/<name>.sol/<name>.json
CONTRACTS=(
  "NewtonProverTaskManager:NewtonProverTaskManagerAbi"
  "AttestationValidator:AttestationValidatorAbi"
  "NewtonPolicy:NewtonPolicyAbi"
  "NewtonPolicyFactory:NewtonPolicyFactoryAbi"
  "NewtonPolicyData:NewtonPolicyDataAbi"
  "NewtonProverServiceManager:NewtonProverServiceManagerAbi"
  "IdentityRegistry:IdentityRegistryAbi"
  "PolicyClientRegistry:PolicyClientRegistryAbi"
  "OperatorRegistry:OperatorRegistryAbi"
  "NewtonPolicyClient:NewtonPolicyClientAbi"
)

echo "Syncing ABIs from $REPO@$BRANCH..."

fetch_abi() {
  local contract_name="$1"
  gh api "repos/$REPO/contents/contracts/out/${contract_name}.sol/${contract_name}.json?ref=$BRANCH" \
    --jq '.content' | base64 -d | node -e "
      const fs = require('fs');
      const json = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
      console.log(JSON.stringify(json.abi, null, 2));
    "
}

# Fetch all ABIs
declare -A ABIS
for entry in "${CONTRACTS[@]}"; do
  contract_name="${entry%%:*}"
  echo "  Fetching ${contract_name}..."
  ABIS["$entry"]=$(fetch_abi "$contract_name")
done

# Generate single output file
cat > "$OUT_DIR/newtonAbi.ts" << 'HEADER'
// Auto-generated from newton-prover-avs contracts. DO NOT EDIT.
// Regenerate with: pnpm sync-abis

HEADER

for entry in "${CONTRACTS[@]}"; do
  export_name="${entry##*:}"
  echo "export const ${export_name} = ${ABIS["$entry"]} as const" >> "$OUT_DIR/newtonAbi.ts"
  echo "" >> "$OUT_DIR/newtonAbi.ts"
done

# Append convenience type re-exports
cat >> "$OUT_DIR/newtonAbi.ts" << 'FOOTER'
// Re-export the TaskResponded event log type for convenience
export type TaskRespondedLog = typeof NewtonProverTaskManagerAbi extends readonly (infer T)[]
  ? T extends { type: 'event'; name: 'TaskResponded' }
    ? T
    : never
  : never
FOOTER

echo "Done. ABIs written to $OUT_DIR/newtonAbi.ts"
echo "Contracts synced: ${#CONTRACTS[@]}"
