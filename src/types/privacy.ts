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

/** Parameters for uploading encrypted data to the gateway. */
export interface UploadEncryptedDataParams {
  /** EVM address of the end user (intent sender) */
  senderAddress: Address
  /** Policy client address this data is scoped to */
  policyClient: Address
  /** Chain ID the policy client lives on */
  chainId: number
  /** Plaintext data to encrypt and upload */
  plaintext: Uint8Array | string | Record<string, unknown>
  /** Gateway's X25519 public key (hex, no 0x prefix). If omitted, fetched via RPC. */
  recipientPublicKey?: string
  /** Ed25519 private key seed (32 bytes as Uint8Array). Caller owns the buffer lifecycle. */
  signingKey: Uint8Array
  /** Optional TTL in seconds (data expires after this duration) */
  ttl?: number
}

/** Parameters for uploading a pre-built SecureEnvelope to the gateway. */
export interface UploadSecureEnvelopeParams {
  /** EVM address of the end user (intent sender) */
  senderAddress: Address
  /** Pre-built envelope result from createSecureEnvelope */
  envelopeResult: SecureEnvelopeResult
  /** Optional TTL in seconds (data expires after this duration) */
  ttl?: number
}

/** Response from the gateway after uploading encrypted data. */
export interface UploadEncryptedDataResponse {
  success: boolean
  /** UUID of the stored data reference (if successful) */
  data_ref_id: string | null
  error: string | null
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

/** RPC request body for newt_uploadEncryptedData. */
export interface UploadEncryptedDataRpcRequest {
  sender_address: Address
  policy_client: Address
  envelope: string
  signature: string
  sender_pubkey: string
  ttl: number | null
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
  /** Encrypted data reference UUIDs returned from uploadEncryptedData */
  encryptedDataRefs: string[]
  /** User's Ed25519 private key seed (hex-encoded, 32 bytes, no 0x prefix) */
  userSigningKey: string
  /** Application's Ed25519 private key seed (hex-encoded, 32 bytes, no 0x prefix) */
  appSigningKey: string
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
