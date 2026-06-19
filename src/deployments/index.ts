import type { Hex } from 'viem'
import { DEPLOYMENTS, type DeploymentKey } from './manifest'
import {
  type DeploymentAddressKey,
  type DeploymentEnvironment,
  type DeploymentFile,
  PROD_DEPLOYMENT_KEYS,
  type SupportedChainId,
  asDeploymentAddress,
} from './types'

export { DEPLOYMENTS, type DeploymentKey }
export {
  type DeploymentAddressKey,
  type DeploymentEnvironment,
  type DeploymentFile,
  type SupportedChainId,
  PROD_DEPLOYMENT_KEYS,
}

export function getDeploymentKey(
  chainId: number,
  environment: DeploymentEnvironment = 'prod',
): DeploymentKey | undefined {
  const prodKey = PROD_DEPLOYMENT_KEYS[chainId as SupportedChainId]
  if (!prodKey) {
    return undefined
  }

  if (environment === 'prod') {
    return prodKey as DeploymentKey
  }

  const stagefKey = `${prodKey.replace(/-prod$/, '')}-stagef` as DeploymentKey
  return stagefKey in DEPLOYMENTS ? stagefKey : undefined
}

export function getDeployment(
  chainId: number,
  environment: DeploymentEnvironment = 'prod',
): DeploymentFile | undefined {
  const key = getDeploymentKey(chainId, environment)
  return key ? (DEPLOYMENTS[key] as DeploymentFile) : undefined
}

export function getDeploymentAddress(
  chainId: number,
  addressKey: DeploymentAddressKey,
  environment: DeploymentEnvironment = 'prod',
): Hex {
  const deployment = getDeployment(chainId, environment)
  if (!deployment) {
    throw new Error(`No ${environment} deployment found for chain ${chainId}`)
  }

  return asDeploymentAddress(deployment.addresses[addressKey], chainId, addressKey)
}

function buildAddressMap(addressKey: DeploymentAddressKey): Record<number, Hex> {
  return Object.fromEntries(
    (Object.keys(PROD_DEPLOYMENT_KEYS) as unknown as SupportedChainId[]).map(chainId => [
      chainId,
      getDeploymentAddress(chainId, addressKey),
    ]),
  ) as Record<number, Hex>
}

export const NEWTON_PROVER_TASK_MANAGER = buildAddressMap('newtonProverTaskManager')
export const ATTESTATION_VALIDATOR = buildAddressMap('attestationValidator')
export const IDENTITY_REGISTRY = buildAddressMap('identityRegistry')
export const POLICY_CLIENT_REGISTRY = buildAddressMap('policyClientRegistry')
export const CONFIDENTIAL_DATA_REGISTRY = buildAddressMap('confidentialDataRegistry')
