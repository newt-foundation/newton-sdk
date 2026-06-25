import type { Hex } from 'viem'
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains'
import {
  ATTESTATION_VALIDATOR as ATTESTATION_VALIDATOR_FROM_DEPLOYMENTS,
  CONFIDENTIAL_DATA_REGISTRY as CONFIDENTIAL_DATA_REGISTRY_FROM_DEPLOYMENTS,
  IDENTITY_REGISTRY as IDENTITY_REGISTRY_FROM_DEPLOYMENTS,
  NEWTON_PROVER_TASK_MANAGER as NEWTON_PROVER_TASK_MANAGER_FROM_DEPLOYMENTS,
  POLICY_CLIENT_REGISTRY as POLICY_CLIENT_REGISTRY_FROM_DEPLOYMENTS,
} from './deployments'

export const GATEWAY_API_URLS: Record<number, string> = {
  [sepolia.id]: 'https://gateway.testnet.newton.xyz/rpc',
  [mainnet.id]: 'https://gateway.newton.xyz/rpc',
  [baseSepolia.id]: 'https://gateway.testnet.newton.xyz/rpc',
  [base.id]: 'https://gateway.newton.xyz/rpc',
} as const

export const GATEWAY_METHODS = {
  createTask: 'newt_createTask',
  sendTask: 'newt_sendTask',
  simulatePolicy: 'newt_simulatePolicy',
  simulateTask: 'newt_simulateTask',
  simulatePolicyData: 'newt_simulatePolicyData',
  simulatePolicyDataWithClient: 'newt_simulatePolicyDataWithClient',
  getPrivacyPublicKey: 'newt_getPrivacyPublicKey',
  getSecretsPublicKey: 'newt_getSecretsPublicKey',
  uploadIdentityEncrypted: 'newt_uploadIdentityEncrypted',
  getIdentityEncrypted: 'newt_getIdentityEncrypted',
  storeEncryptedSecrets: 'newt_storeEncryptedSecrets',
  uploadConfidentialData: 'newt_uploadConfidentialData',
  getConfidentialData: 'newt_getConfidentialData',
  registerWebhook: 'newt_registerWebhook',
  unregisterWebhook: 'newt_unregisterWebhook',
}

/** NewtonProverTaskManager contracts — synced from newton-contracts deployments. */
export const NEWTON_PROVER_TASK_MANAGER: Partial<Record<number, Hex>> = NEWTON_PROVER_TASK_MANAGER_FROM_DEPLOYMENTS

/** AttestationValidator contracts — verify BLS aggregate signatures on-chain. */
export const ATTESTATION_VALIDATOR: Partial<Record<number, Hex>> = ATTESTATION_VALIDATOR_FROM_DEPLOYMENTS

/** IdentityRegistry contracts — on-chain identity data refs and policy client links. */
export const IDENTITY_REGISTRY: Partial<Record<number, Hex>> = IDENTITY_REGISTRY_FROM_DEPLOYMENTS

/** PolicyClientRegistry contracts — on-chain policy client registration and lifecycle. */
export const POLICY_CLIENT_REGISTRY: Partial<Record<number, Hex>> = POLICY_CLIENT_REGISTRY_FROM_DEPLOYMENTS

/** ConfidentialDataRegistry contracts — on-chain provider-managed confidential data refs. */
export const CONFIDENTIAL_DATA_REGISTRY: Partial<Record<number, Hex>> = CONFIDENTIAL_DATA_REGISTRY_FROM_DEPLOYMENTS

export {
  DEPLOYMENTS,
  getDeployment,
  getDeploymentAddress,
  getDeploymentKey,
  type DeploymentAddressKey,
  type DeploymentFile,
  type DeploymentKey,
  type SupportedChainId,
  DEPLOYMENT_KEYS,
} from './deployments'
