import type { Address } from 'viem'

/** HPKE-encrypted data envelope for privacy-preserving transport. */
export interface SecureEnvelope {
  /** HPKE encapsulated key (hex-encoded, no 0x prefix) */
  enc: string
  /** HPKE ciphertext including Poly1305 auth tag (hex-encoded, no 0x prefix) */
  ciphertext: string
  /** Policy client address (0x-prefixed) */
  policy_client: Address
  /** Chain ID for AAD context binding */
  chain_id: number
  /** Recipient X25519 public key (hex-encoded, no 0x prefix) */
  recipient_pubkey: string
}

/** Parameters for creating a SecureEnvelope (offline, zero network calls). */
export interface CreateSecureEnvelopeParams {
  /** Plaintext data to encrypt (will be JSON-stringified if not a Uint8Array) */
  plaintext: Uint8Array | string | Record<string, unknown>
  /** Policy client address this data is scoped to */
  policyClient: Address
  /** Chain ID for AAD context binding */
  chainId: number
  /** Gateway's X25519 public key (hex-encoded, 32 bytes, no 0x prefix) */
  recipientPublicKey: string
}

/** Result of creating a SecureEnvelope with Ed25519 signature. */
export interface SecureEnvelopeResult {
  /** The encrypted envelope */
  envelope: SecureEnvelope
  /** Ed25519 signature over the serialized envelope (hex-encoded, no 0x prefix) */
  signature: string
  /** Sender's Ed25519 public key (hex-encoded, no 0x prefix) */
  senderPublicKey: string
}

/** Parameters for uploading encrypted identity data to the gateway. */
export interface UploadIdentityEncryptedParams {
  /** EVM address of the identity owner */
  identityOwner: Address
  /** EIP-712 signature of the SecureEnvelope JSON by the identity owner (hex-encoded) */
  identityOwnerSig: string
  /** JSON-serialized SecureEnvelope (from createSecureEnvelope) */
  envelope: string
  /** Identity domain as 0x-prefixed bytes32 hex (e.g., keccak256("kyc")) */
  identityDomain: `0x${string}`
  /** Chain ID the identity registry lives on */
  chainId: number
}

/** Response from the gateway after uploading encrypted identity data. */
export interface UploadIdentityEncryptedResponse {
  /** Content-hash data reference ID: keccak256(envelope_json_bytes) */
  data_ref_id: string
  /** Gateway EIP-712 signature for registerIdentityData on-chain call */
  gateway_signature: string
  /** Signature expiration (unix timestamp) for registerIdentityData */
  deadline: number
}

/** Response from newt_getPrivacyPublicKey. */
export interface PrivacyPublicKeyResponse {
  /** X25519 public key (hex-encoded, no 0x prefix) */
  public_key: string
  /** Key type (always "x25519") */
  key_type: string
  /** Encryption suite identifier */
  encryption_suite: string
}

/** RPC request body for newt_uploadIdentityEncrypted. */
export interface UploadIdentityEncryptedRpcRequest {
  identity_owner: Address
  identity_owner_sig: string
  envelope: string
  identity_domain: `0x${string}`
  chain_id: number
}

/** An Ed25519 key pair for signing envelopes and privacy authorization. */
export interface Ed25519KeyPair {
  /** Ed25519 private key seed (hex-encoded, 32 bytes, no 0x prefix) */
  privateKey: string
  /** Ed25519 public key (hex-encoded, 32 bytes, no 0x prefix) */
  publicKey: string
}

/** Parameters for uploading HPKE-encrypted secrets for a policy client. */
export interface StoreEncryptedSecretsParams {
  /** Policy client address secrets are scoped to */
  policyClient: Address
  /** PolicyData address secrets are scoped to */
  policyDataAddress: Address
  /** Plaintext secrets as a JSON object (e.g., { "API_KEY_1": "...", "API_KEY_2": "..." }) */
  plaintext: Record<string, unknown>
  /** Chain ID the policy client lives on */
  chainId: number
  /** Gateway's X25519 public key (hex, no 0x prefix). If omitted, fetched via RPC. */
  recipientPublicKey?: string
}

/** Response from newt_storeEncryptedSecrets. */
export interface StoreEncryptedSecretsResponse {
  success: boolean
  /** The policy data schema JSON used for validation (present on success) */
  schema: Record<string, unknown> | null
  /** Error message (present on failure) */
  error: string | null
}

/** RPC request body for newt_storeEncryptedSecrets. */
export interface StoreEncryptedSecretsRpcRequest {
  policy_client: Address
  policy_data_address: Address
  envelope: string
  chain_id: number
}

/** Parameters for computing dual-signature privacy authorization. */
export interface SignPrivacyAuthorizationParams {
  /** Policy client address */
  policyClient: Address
  /** Keccak256 hash of the intent (hex-encoded, 32 bytes) */
  intentHash: string
  /** Encrypted data reference UUIDs returned from uploadIdentityEncrypted */
  encryptedDataRefs: string[]
  /** User's Ed25519 private key seed (hex-encoded, 32 bytes, no 0x prefix) */
  userSigningKey: string
  /** Application's Ed25519 private key seed (hex-encoded, 32 bytes, no 0x prefix) */
  appSigningKey: string
}

/** Parameters for uploading HPKE-encrypted confidential data (blacklists, allowlists, etc.) to the gateway. */
export interface UploadConfidentialDataParams {
  /** Provider address (must be registered on-chain with ConfidentialDataRegistry) */
  provider: string
  /** Confidential domain as 0x-prefixed bytes32 hex (e.g., keccak256("newton.privacy.blacklist")) */
  domain: string
  /** Data to encrypt (will be JSON.stringify'd if not a string or Uint8Array) */
  plaintext: Uint8Array | string | Record<string, unknown>
  /** Chain ID for AAD context binding */
  chainId: number
  /** Gateway's X25519 public key (hex, no 0x prefix). If omitted, fetched via RPC. */
  recipientPublicKey?: string
}

/** Response from newt_uploadConfidentialData. */
export interface UploadConfidentialDataResult {
  /** Content-hash data reference ID */
  data_ref_id: string
}

/** RPC request body for newt_uploadConfidentialData. */
export interface UploadConfidentialDataRpcRequest {
  provider: string
  domain: string
  envelope: string
  chain_id: number
}

/** Response from newt_getConfidentialData. */
export interface GetConfidentialDataResult {
  /** JSON-serialized SecureEnvelope */
  envelope: string
  /** Confidential domain as 0x-prefixed bytes32 hex */
  domain: string
  /** Provider address */
  provider: string
}

/** Result of dual-signature privacy authorization computation. */
export interface PrivacyAuthorizationResult {
  /** User Ed25519 signature (hex-encoded, no 0x prefix) */
  userSignature: string
  /** Application Ed25519 signature (hex-encoded, no 0x prefix) */
  appSignature: string
  /** User's Ed25519 public key (hex-encoded, no 0x prefix) */
  userPublicKey: string
  /** Application's Ed25519 public key (hex-encoded, no 0x prefix) */
  appPublicKey: string
}

/** Response from newt_getSecretsPublicKey (may differ from privacy key in threshold DKG mode). */
export interface SecretsPublicKeyResponse {
  /** X25519 public key (hex-encoded, no 0x prefix) */
  public_key: string
  /** Key type (always "x25519") */
  key_type: string
  /** Encryption suite identifier */
  encryption_suite: string
}

/** Parameters for fetching encrypted identity data by reference ID. */
export interface GetIdentityEncryptedParams {
  /** Content-hash data reference ID (keccak256 of the encrypted data) */
  dataRefId: string
}

/** Response from newt_getIdentityEncrypted. */
export interface GetIdentityEncryptedResult {
  /** The HPKE-encrypted identity data as a SecureEnvelope JSON string */
  envelope: string
  /** The identity domain this data was registered under */
  identity_domain: string
  /** The identity owner address */
  identity_owner: string
}
