// Auto-generated from newton-contracts. DO NOT EDIT.
// Regenerate with: pnpm sync-deployments

import newton_cross_chain_1_prod from './newton-cross-chain/1-prod.json'
import newton_cross_chain_8453_prod from './newton-cross-chain/8453-prod.json'
import newton_cross_chain_84532_prod from './newton-cross-chain/84532-prod.json'
import newton_cross_chain_11155111_prod from './newton-cross-chain/11155111-prod.json'
import newton_prover_1_prod from './newton-prover/1-prod.json'
import newton_prover_11155111_prod from './newton-prover/11155111-prod.json'

export const DEPLOYMENTS = {
  'newton-cross-chain/1-prod': newton_cross_chain_1_prod,
  'newton-cross-chain/8453-prod': newton_cross_chain_8453_prod,
  'newton-cross-chain/84532-prod': newton_cross_chain_84532_prod,
  'newton-cross-chain/11155111-prod': newton_cross_chain_11155111_prod,
  'newton-prover/1-prod': newton_prover_1_prod,
  'newton-prover/11155111-prod': newton_prover_11155111_prod,
} as const

export type DeploymentKey = keyof typeof DEPLOYMENTS
