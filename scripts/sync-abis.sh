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

echo "Syncing ABIs from $REPO@$BRANCH..."

# Fetch TaskManager ABI
echo "  Fetching NewtonProverTaskManager ABI..."
TASK_MANAGER_ABI=$(gh api "repos/$REPO/contents/contracts/out/NewtonProverTaskManager.sol/NewtonProverTaskManager.json?ref=$BRANCH" \
  --jq '.content' | base64 -d | node -e "
    const fs = require('fs');
    const json = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
    console.log(JSON.stringify(json.abi, null, 2));
  ")

# Fetch AttestationValidator ABI
echo "  Fetching AttestationValidator ABI..."
ATTESTATION_ABI=$(gh api "repos/$REPO/contents/contracts/out/AttestationValidator.sol/AttestationValidator.json?ref=$BRANCH" \
  --jq '.content' | base64 -d | node -e "
    const fs = require('fs');
    const json = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
    console.log(JSON.stringify(json.abi, null, 2));
  ")

# Fetch Policy ABI
echo "  Fetching NewtonPolicy ABI..."
POLICY_ABI=$(gh api "repos/$REPO/contents/contracts/out/NewtonPolicy.sol/NewtonPolicy.json?ref=$BRANCH" \
  --jq '.content' | base64 -d | node -e "
    const fs = require('fs');
    const json = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
    console.log(JSON.stringify(json.abi, null, 2));
  ")

# Generate newtonAbi.ts
cat > "$OUT_DIR/newtonAbi.ts" << HEREDOC
// Auto-generated from newton-prover-avs contracts. DO NOT EDIT.
// Regenerate with: pnpm sync-abis

export const NewtonProverTaskManagerAbi = ${TASK_MANAGER_ABI} as const

export const AttestationValidatorAbi = ${ATTESTATION_ABI} as const

// Re-export the TaskResponded event log type for convenience
export type TaskRespondedLog = typeof NewtonProverTaskManagerAbi extends readonly (infer T)[]
  ? T extends { type: 'event'; name: 'TaskResponded' }
    ? T
    : never
  : never
HEREDOC

# Generate newtonPolicyAbi.ts
cat > "$OUT_DIR/newtonPolicyAbi.ts" << HEREDOC
// Auto-generated from newton-prover-avs contracts. DO NOT EDIT.
// Regenerate with: pnpm sync-abis

export const NewtonPolicyAbi = ${POLICY_ABI} as const
HEREDOC

echo "Done. ABIs written to $OUT_DIR/"
echo "  - newtonAbi.ts (TaskManager + AttestationValidator)"
echo "  - newtonPolicyAbi.ts (Policy)"
