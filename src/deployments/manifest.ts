// Auto-generated from newton-contracts. DO NOT EDIT.
// Regenerate with: pnpm sync-deployments

import core_1_prod from './core/1-prod.json'
import core_1_stagef from './core/1-stagef.json'
import core_84532_prod from './core/84532-prod.json'
import core_84532_stagef from './core/84532-stagef.json'
import core_11155111_prod from './core/11155111-prod.json'
import core_11155111_stagef from './core/11155111-stagef.json'
import newton_cross_chain_1_prod from './newton-cross-chain/1-prod.json'
import newton_cross_chain_1_stagef from './newton-cross-chain/1-stagef.json'
import newton_cross_chain_8453_prod from './newton-cross-chain/8453-prod.json'
import newton_cross_chain_8453_stagef from './newton-cross-chain/8453-stagef.json'
import newton_cross_chain_84532_prod from './newton-cross-chain/84532-prod.json'
import newton_cross_chain_84532_stagef from './newton-cross-chain/84532-stagef.json'
import newton_cross_chain_11155111_prod from './newton-cross-chain/11155111-prod.json'
import newton_cross_chain_11155111_stagef from './newton-cross-chain/11155111-stagef.json'
import newton_prover_1_prod from './newton-prover/1-prod.json'
import newton_prover_1_stagef from './newton-prover/1-stagef.json'
import newton_prover_11155111_prod from './newton-prover/11155111-prod.json'
import newton_prover_11155111_stagef from './newton-prover/11155111-stagef.json'
import policy_1_prod from './policy/1-prod.json'
import policy_1_stagef from './policy/1-stagef.json'
import policy_8453_prod from './policy/8453-prod.json'
import policy_8453_stagef from './policy/8453-stagef.json'
import policy_84532_prod from './policy/84532-prod.json'
import policy_84532_stagef from './policy/84532-stagef.json'
import policy_11155111_prod from './policy/11155111-prod.json'
import policy_11155111_stagef from './policy/11155111-stagef.json'

export const DEPLOYMENTS = {
  'core/1-prod': core_1_prod,
  'core/1-stagef': core_1_stagef,
  'core/84532-prod': core_84532_prod,
  'core/84532-stagef': core_84532_stagef,
  'core/11155111-prod': core_11155111_prod,
  'core/11155111-stagef': core_11155111_stagef,
  'newton-cross-chain/1-prod': newton_cross_chain_1_prod,
  'newton-cross-chain/1-stagef': newton_cross_chain_1_stagef,
  'newton-cross-chain/8453-prod': newton_cross_chain_8453_prod,
  'newton-cross-chain/8453-stagef': newton_cross_chain_8453_stagef,
  'newton-cross-chain/84532-prod': newton_cross_chain_84532_prod,
  'newton-cross-chain/84532-stagef': newton_cross_chain_84532_stagef,
  'newton-cross-chain/11155111-prod': newton_cross_chain_11155111_prod,
  'newton-cross-chain/11155111-stagef': newton_cross_chain_11155111_stagef,
  'newton-prover/1-prod': newton_prover_1_prod,
  'newton-prover/1-stagef': newton_prover_1_stagef,
  'newton-prover/11155111-prod': newton_prover_11155111_prod,
  'newton-prover/11155111-stagef': newton_prover_11155111_stagef,
  'policy/1-prod': policy_1_prod,
  'policy/1-stagef': policy_1_stagef,
  'policy/8453-prod': policy_8453_prod,
  'policy/8453-stagef': policy_8453_stagef,
  'policy/84532-prod': policy_84532_prod,
  'policy/84532-stagef': policy_84532_stagef,
  'policy/11155111-prod': policy_11155111_prod,
  'policy/11155111-stagef': policy_11155111_stagef,
} as const

export type DeploymentKey = keyof typeof DEPLOYMENTS
