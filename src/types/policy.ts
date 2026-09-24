import type { Address, Hex } from 'viem'

export type PolicyId = string

export interface PolicyParamsJson {
  admin: string
  allowed_actions: {
    [chainId: string]: {
      address: string
      function_name: string
      max_limit: number
    }
  }
  token_whitelist: {
    [chainId: string]: {
      address: string
      max_limit: number
      symbol: string
    }
  }
} // developer-supplied
export interface SetPolicyInput {
  client: Address // policy client (e.g., vault) address
  policyContract: Address // deployed policy contract (code/metadata)
  params: PolicyParamsJson // JSON object → encoded to bytes passed to setPolicy
}

export interface SetPolicyResult {
  ok: true
  policyId: PolicyId
  txHash: Hex
}

export interface PolicyInfo {
  policyId: PolicyId
  client: Address
  policyContract: Address
  paramsBytes: Hex // canonical bytes as stored on-chain
  paramsJson?: PolicyParamsJson // optional decode if schema known
}

export interface PolicyCodeInfo {
  codeUri: string // e.g., IPFS for Rego or other
}

/** Per-policy configuration stored alongside each policy in a client's set. */
export interface PolicyConfig {
  policyParams: Hex
  /** Attestation lifetime in blocks. Must be non-zero. */
  expireAfter: number
}

/** One entry in a client's ordered policy set. Order is significant and repeats are legal. */
export interface PolicySpec {
  policy: Address
  config: PolicyConfig
}

/** keccak256("newton.policy.set") */
export const POLICY_SET_DOMAIN = '0x671cdd5663cea1dd5f0b42278ce65570194bc54e20449731d2ae86713689de91' as Hex
