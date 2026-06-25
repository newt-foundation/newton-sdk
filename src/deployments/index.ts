import type { Hex } from 'viem'
import { DEPLOYMENTS, type DeploymentKey } from './manifest'
import {
  DEPLOYMENT_KEYS,
  type DeploymentAddressKey,
  type DeploymentFile,
  type SupportedChainId,
  asDeploymentAddress,
} from './types'

export { DEPLOYMENTS, type DeploymentKey }
export { type DeploymentAddressKey, type DeploymentFile, type SupportedChainId, DEPLOYMENT_KEYS }

export function getDeploymentKey(chainId: number): DeploymentKey | undefined {
  const key = DEPLOYMENT_KEYS[chainId as SupportedChainId]
  return key as DeploymentKey | undefined
}

export function getDeployment(chainId: number): DeploymentFile | undefined {
  const key = getDeploymentKey(chainId)
  return key ? (DEPLOYMENTS[key] as DeploymentFile) : undefined
}

export function getDeploymentAddress(chainId: number, addressKey: DeploymentAddressKey): Hex {
  const deployment = getDeployment(chainId)
  if (!deployment) {
    throw new Error(`No deployment found for chain ${chainId}`)
  }

  return asDeploymentAddress(deployment.addresses[addressKey], chainId, addressKey)
}

function buildAddressMap(addressKey: DeploymentAddressKey): Partial<Record<SupportedChainId, Hex>> {
  const map: Partial<Record<SupportedChainId, Hex>> = {}
  for (const chainIdKey in DEPLOYMENT_KEYS) {
    const chainId = Number(chainIdKey) as SupportedChainId
    const address = getDeployment(chainId)?.addresses[addressKey]
    if (address) {
      map[chainId] = asDeploymentAddress(address, chainId, addressKey)
    }
  }
  return map
}

export const NEWTON_PROVER_TASK_MANAGER = buildAddressMap('newtonProverTaskManager')
export const ATTESTATION_VALIDATOR = buildAddressMap('attestationValidator')
export const IDENTITY_REGISTRY = buildAddressMap('identityRegistry')
export const POLICY_CLIENT_REGISTRY = buildAddressMap('policyClientRegistry')
export const CONFIDENTIAL_DATA_REGISTRY = buildAddressMap('confidentialDataRegistry')
