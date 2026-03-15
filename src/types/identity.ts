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

/** Parameters for linkIdentityAsSignerAndUser — caller is both identity owner and client user. */
export interface LinkIdentityAsSignerAndUserParams {
  policyClient: Address
  identityDomains: Hex[]
}

/** Parameters for linkIdentityAsSigner — caller is the identity owner, counterparty signature from client user. */
export interface LinkIdentityAsSignerParams {
  policyClient: Address
  identityDomains: Hex[]
  clientUser: Address
  clientUserSignature: Hex
  clientUserNonce: bigint
  clientUserDeadline: bigint
}

/** Parameters for linkIdentityAsUser — caller is the client user, counterparty signature from identity owner. */
export interface LinkIdentityAsUserParams {
  identityOwner: Address
  policyClient: Address
  identityDomains: Hex[]
  identityOwnerSignature: Hex
  identityOwnerNonce: bigint
  identityOwnerDeadline: bigint
}

/** Parameters for linkIdentity — 3rd party submits with signatures from both identity owner and client user. */
export interface LinkIdentityParams {
  identityOwner: Address
  clientUser: Address
  policyClient: Address
  identityDomains: Hex[]
  identityOwnerSignature: Hex
  identityOwnerNonce: bigint
  identityOwnerDeadline: bigint
  clientUserSignature: Hex
  clientUserNonce: bigint
  clientUserDeadline: bigint
}

/** Parameters for unlinkIdentityAsSigner — caller is the identity owner. */
export interface UnlinkIdentityAsSignerParams {
  clientUser: Address
  policyClient: Address
  identityDomains: Hex[]
}

/** Parameters for unlinkIdentityAsUser — caller is the client user. */
export interface UnlinkIdentityAsUserParams {
  policyClient: Address
  identityDomains: Hex[]
}
