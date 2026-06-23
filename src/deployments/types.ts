import type { Hex } from 'viem'

export type DeploymentAddresses = {
  newtonProverTaskManager?: string
  attestationValidator?: string
  identityRegistry?: string
  policyClientRegistry?: string
  confidentialDataRegistry?: string
  [key: string]: string | undefined
}

export type DeploymentFile = {
  lastUpdate?: {
    timestamp?: string
    block_number?: string
  }
  type?: string
  sourceChainId?: string
  addresses: DeploymentAddresses
}

export type DeploymentAddressKey =
  | 'newtonProverTaskManager'
  | 'attestationValidator'
  | 'identityRegistry'
  | 'policyClientRegistry'
  | 'confidentialDataRegistry'

/** Production deployment JSON path per supported SDK chain. */
export const DEPLOYMENT_KEYS = {
  11155111: 'newton-prover/11155111-prod',
  1: 'newton-prover/1-prod',
  8453: 'newton-cross-chain/8453-prod',
  84532: 'newton-cross-chain/84532-prod',
} as const satisfies Record<number, string>

export type SupportedChainId = keyof typeof DEPLOYMENT_KEYS

const DEPLOYMENT_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/

export function asDeploymentAddress(address: string | undefined, chainId: number, key: DeploymentAddressKey): Hex {
  if (!address) {
    throw new Error(`Missing deployment address "${key}" for chain ${chainId}`)
  }
  if (!DEPLOYMENT_ADDRESS_PATTERN.test(address)) {
    throw new Error(`Invalid deployment address "${key}" for chain ${chainId}: ${JSON.stringify(address)}`)
  }
  return address as Hex
}
