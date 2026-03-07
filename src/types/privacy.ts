import type { Address } from 'viem'

/** HPKE-encrypted data envelope for privacy-preserving transport. */
export interface SecureEnvelope {
  /** HPKE encapsulated key (hex-encoded, no 0x prefix) */
  enc: string
  /** HPKE ciphertext including Poly1305 auth tag (hex-encoded, no 0x prefix) */
  ciphertext: string
  /** Policy client address (0x-prefixed) */
  policy_client: string
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
  /** Ed25519 private key for signing (32-byte seed, hex-encoded, no 0x prefix) */
  signingKey: string
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
  recipient_pubkey: string
  ttl: number | null
  chain_id: number
}
