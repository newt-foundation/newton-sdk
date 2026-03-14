import type { Address, Hex } from 'viem'

type DateString = `${number}${number}${number}${number}-${number}${number}-${number}${number}`

export interface KycUserData {
  status: string
  selected_country_code: string
  address_subdivision: string
  address_country_code: string
  birthdate: DateString
  expiration_date: DateString
  issue_date: DateString
  issuing_authority: string
}

/** Well-known identity domain name strings. */
export type IdentityDomainName = 'kyc'

/** Parameters for sending encrypted identity data to the gateway. */
export interface SendIdentityEncryptedParams {
  /** The identity owner's EVM address (must match the wallet signer) */
  identityOwner: Address
  /** The encrypted identity data blob (opaque string — encrypted by the caller) */
  identityData: string
  /** Identity domain name (e.g., "kyc"). Hashed to bytes32 via keccak256. */
  identityDomain: IdentityDomainName | string
  /** IdentityRegistry contract address for the EIP-712 domain */
  identityRegistryAddress: Address
}

/** Response from newt_sendIdentityEncrypted. */
export interface SendIdentityEncryptedResponse {
  /** Transaction hash where the identity data was included on-chain */
  inclusion_tx: string
}

/** RPC request body for newt_sendIdentityEncrypted (snake_case, matches gateway). */
export interface SendIdentityEncryptedRpcRequest {
  identity_owner: Address
  identity_owner_sig: Hex
  identity_data: { data: string }
  identity_domain: Hex
}
