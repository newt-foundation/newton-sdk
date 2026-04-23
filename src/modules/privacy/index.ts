/**
 * Newton Privacy Module — Client-side HPKE encryption for privacy-preserving policy evaluation.
 *
 * Encryption suite: X25519 KEM + HKDF-SHA256 + ChaCha20-Poly1305 (RFC 9180, Base mode).
 * Compatible with the Rust gateway's `crates/core/src/crypto/hpke.rs`.
 *
 * Key design constraints:
 * - Zero network calls during encrypt/createSecureEnvelope
 * - Offline capable once the gateway public key is known
 * - Ephemeral keys zeroed after encryption
 */

import { GATEWAY_METHODS } from '@core/const'
import type {
  CreateSecureEnvelopeParams,
  Ed25519KeyPair,
  GetConfidentialDataResult,
  GetIdentityEncryptedResult,
  PrivacyAuthorizationResult,
  PrivacyPublicKeyResponse,
  SecretsPublicKeyResponse,
  SecureEnvelope,
  SecureEnvelopeResult,
  SignPrivacyAuthorizationParams,
  StoreEncryptedSecretsParams,
  StoreEncryptedSecretsResponse,
  StoreEncryptedSecretsRpcRequest,
  UploadConfidentialDataParams,
  UploadConfidentialDataResult,
  UploadConfidentialDataRpcRequest,
  UploadIdentityEncryptedParams,
  UploadIdentityEncryptedResponse,
  UploadIdentityEncryptedRpcRequest,
} from '@core/types/privacy'
import { AvsHttpService } from '@core/utils/https'
import { Chacha20Poly1305 } from '@hpke/chacha20poly1305'
import { CipherSuite, DhkemX25519HkdfSha256, HkdfSha256 } from '@hpke/core'
import { ed25519 } from '@noble/curves/ed25519.js'
import { type Hex, hexToBytes, isAddress, isHex, keccak256, toHex } from 'viem'

// ---------------------------------------------------------------------------
// HPKE ciphersuite (matches Rust: X25519 + HKDF-SHA256 + ChaCha20Poly1305)
// ---------------------------------------------------------------------------

const suite = new CipherSuite({
  kem: new DhkemX25519HkdfSha256(),
  kdf: new HkdfSha256(),
  aead: new Chacha20Poly1305(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert plaintext input to bytes for encryption. */
function plaintextToBytes(input: Uint8Array | string | Record<string, unknown>): Uint8Array {
  if (input instanceof Uint8Array) return input
  const str = typeof input === 'string' ? input : JSON.stringify(input)
  return new TextEncoder().encode(str)
}

/** Normalize a hex string to 0x-prefixed Hex. */
function ensureHexPrefix(hex: string): Hex {
  const prefixed = hex.startsWith('0x') ? hex : `0x${hex}`
  if (!isHex(prefixed)) throw new Error(`invalid hex string: ${hex}`)
  return prefixed as Hex
}

/** Convert bytes to hex without 0x prefix (for envelope fields). */
function bytesToUnprefixedHex(bytes: Uint8Array): string {
  return toHex(bytes).slice(2)
}

/**
 * Compute AAD as keccak256(abi.encodePacked(policy_client_bytes, chain_id_be_bytes)).
 * Binds ciphertext to a specific policy_client + chain_id, preventing cross-context replay.
 * Must match the Rust implementation in `crates/core/src/crypto/envelope.rs`.
 */
function computeAad(policyClient: Hex, chainId: number): Uint8Array {
  if (!isAddress(policyClient)) throw new Error(`invalid policy client address: ${policyClient}`)
  const clientBytes = hexToBytes(policyClient)
  // chain_id as big-endian u64 (8 bytes) — BigInt required for parity with Rust's u64 in abi.encodePacked
  const chainIdBytes = new Uint8Array(8)
  const view = new DataView(chainIdBytes.buffer)
  view.setBigUint64(0, BigInt(chainId))

  const packed = new Uint8Array(clientBytes.length + 8)
  packed.set(clientBytes, 0)
  packed.set(chainIdBytes, clientBytes.length)

  // viem's keccak256 accepts Uint8Array and returns 0x-prefixed hex
  return hexToBytes(keccak256(packed))
}

/**
 * Zero out a Uint8Array in-place for ephemeral key material.
 */
function zeroize(arr: Uint8Array): void {
  arr.fill(0)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a SecureEnvelope by encrypting plaintext with HPKE.
 *
 * This is a pure, offline function — zero network calls.
 * The ephemeral HPKE key is generated internally and zeroed after use.
 *
 * SECURITY: The caller owns the signingKey buffer lifecycle and must zeroize it when done.
 * This function copies the key internally and zeroes the copy after signing, but the
 * original Uint8Array remains in the caller's control.
 *
 * @param params - Encryption parameters
 * @param signingKey - Ed25519 private key seed (32 bytes as Uint8Array)
 * @returns Envelope + Ed25519 signature over the serialized envelope
 */
export async function createSecureEnvelope(
  params: CreateSecureEnvelopeParams,
  signingKey: Uint8Array,
): Promise<SecureEnvelopeResult> {
  const { policyClient, chainId, recipientPublicKey } = params

  // Validate inputs
  if (!isAddress(policyClient)) throw new Error(`invalid policy client address: ${policyClient}`)
  if (signingKey.length !== 32) throw new Error('signingKey must be exactly 32 bytes (Ed25519 seed)')

  const recipientPkHex = ensureHexPrefix(recipientPublicKey)
  const recipientPkBytes = hexToBytes(recipientPkHex)
  if (recipientPkBytes.length !== 32) throw new Error('recipientPublicKey must be exactly 32 bytes (X25519 key)')

  const plaintext = plaintextToBytes(params.plaintext)

  // Compute AAD (matches Rust: keccak256(abi.encodePacked(policy_client, chain_id)))
  const aad = computeAad(policyClient, chainId)

  // Deserialize recipient's X25519 public key
  const recipientKey = await suite.kem.deserializePublicKey(recipientPkBytes.buffer as ArrayBuffer)

  // HPKE single-shot seal (Base mode, empty info)
  const emptyInfo = new ArrayBuffer(0)
  const sender = await suite.createSenderContext({ recipientPublicKey: recipientKey, info: emptyInfo })
  const ciphertext = await sender.seal(plaintext.buffer as ArrayBuffer, aad.buffer as ArrayBuffer)

  // Extract the encapsulated key
  const encBytes = new Uint8Array(sender.enc)

  // Build the envelope
  const envelope: SecureEnvelope = {
    enc: bytesToUnprefixedHex(encBytes),
    ciphertext: bytesToUnprefixedHex(new Uint8Array(ciphertext)),
    policy_client: policyClient,
    chain_id: chainId,
    recipient_pubkey: recipientPublicKey,
  }

  // Sign the serialized envelope with Ed25519
  const signingKeyCopy = new Uint8Array(signingKey)
  const envelopeJson = JSON.stringify(envelope)
  const envelopeBytes = new TextEncoder().encode(envelopeJson)
  const signature = ed25519.sign(envelopeBytes, signingKeyCopy)
  const senderPublicKey = ed25519.getPublicKey(signingKeyCopy)

  // Zeroize our internal copy of the signing key
  zeroize(signingKeyCopy)

  return {
    envelope,
    signature: bytesToUnprefixedHex(signature),
    senderPublicKey: bytesToUnprefixedHex(senderPublicKey),
  }
}

/**
 * Fetch the gateway's X25519 HPKE public key.
 *
 * Clients call this once to discover which key to encrypt SecureEnvelopes to.
 * The result can be cached — the key only changes on gateway restart or key rotation.
 */
export async function getPrivacyPublicKey(
  chainId: number,
  apiKey: string,
  gatewayApiUrlOverride?: string,
): Promise<PrivacyPublicKeyResponse> {
  const avsHttpService = new AvsHttpService(chainId, gatewayApiUrlOverride)
  const res = await avsHttpService.Post(GATEWAY_METHODS.getPrivacyPublicKey, {}, apiKey)
  if (res.error) throw res.error
  return res.result as PrivacyPublicKeyResponse
}

/**
 * Upload encrypted identity data to the gateway.
 *
 * The caller must provide a pre-built SecureEnvelope (via createSecureEnvelope)
 * and an EIP-712 signature of the envelope JSON from the identity owner.
 * The gateway stores the envelope and returns a data_ref_id + gateway signature
 * for the on-chain registerIdentityData call.
 */
export async function uploadIdentityEncrypted(
  chainId: number,
  apiKey: string,
  params: UploadIdentityEncryptedParams,
  gatewayApiUrlOverride?: string,
): Promise<UploadIdentityEncryptedResponse> {
  const rpcRequest: UploadIdentityEncryptedRpcRequest = {
    identity_owner: params.identityOwner,
    identity_owner_sig: params.identityOwnerSig,
    envelope: params.envelope,
    identity_domain: params.identityDomain,
    chain_id: params.chainId,
  }

  const avsHttpService = new AvsHttpService(chainId, gatewayApiUrlOverride)
  const res = await avsHttpService.Post(GATEWAY_METHODS.uploadIdentityEncrypted, rpcRequest, apiKey)
  if (res.error) throw res.error
  return res.result as UploadIdentityEncryptedResponse
}

/**
 * Fetch encrypted identity data by its content-hash reference ID.
 *
 * Used to resolve a data_ref_id (stored on-chain in IdentityRegistry) back to
 * the actual encrypted data blob (stored off-chain in the gateway).
 */
export async function getIdentityEncrypted(
  chainId: number,
  apiKey: string,
  dataRefId: string,
  gatewayApiUrlOverride?: string,
): Promise<GetIdentityEncryptedResult> {
  const avsHttpService = new AvsHttpService(chainId, gatewayApiUrlOverride)
  const res = await avsHttpService.Post(GATEWAY_METHODS.getIdentityEncrypted, { data_ref_id: dataRefId }, apiKey)
  if (res.error) throw res.error
  return res.result as GetIdentityEncryptedResult
}

/**
 * Fetch the gateway's X25519 HPKE public key for WASM secrets encryption.
 *
 * In threshold DKG mode, this returns a different key than getPrivacyPublicKey.
 * Use this key when encrypting secrets via storeEncryptedSecrets.
 */
export async function getSecretsPublicKey(
  chainId: number,
  apiKey: string,
  gatewayApiUrlOverride?: string,
): Promise<SecretsPublicKeyResponse> {
  const avsHttpService = new AvsHttpService(chainId, gatewayApiUrlOverride)
  const res = await avsHttpService.Post(GATEWAY_METHODS.getSecretsPublicKey, {}, apiKey)
  if (res.error) throw res.error
  return res.result as SecretsPublicKeyResponse
}

/**
 * Generate a random Ed25519 key pair for signing envelopes and privacy authorization.
 *
 * This is a pure offline function. The private key is generated from 32 bytes of
 * cryptographically secure randomness via `crypto.getRandomValues`.
 */
export function generateSigningKeyPair(): Ed25519KeyPair {
  const privateKeyBytes = new Uint8Array(32)
  crypto.getRandomValues(privateKeyBytes)
  const publicKeyBytes = ed25519.getPublicKey(privateKeyBytes)
  const keyPair: Ed25519KeyPair = {
    privateKey: bytesToUnprefixedHex(privateKeyBytes),
    publicKey: bytesToUnprefixedHex(publicKeyBytes),
  }
  zeroize(privateKeyBytes)
  return keyPair
}

/**
 * Upload HPKE-encrypted secrets for a policy client's PolicyData.
 *
 * The gateway decrypts the HPKE envelope, validates the plaintext against
 * the PolicyData schema, and stores the envelope for operator-side decryption
 * during policy evaluation.
 */
export async function storeEncryptedSecrets(
  chainId: number,
  apiKey: string,
  params: StoreEncryptedSecretsParams,
  gatewayApiUrlOverride?: string,
): Promise<StoreEncryptedSecretsResponse> {
  // Secrets use a different HPKE key than privacy data (may differ in threshold DKG mode)
  let recipientPublicKey = params.recipientPublicKey
  if (!recipientPublicKey) {
    const keyResponse = await getSecretsPublicKey(chainId, apiKey, gatewayApiUrlOverride)
    recipientPublicKey = keyResponse.public_key
  }

  const ephemeralKey = new Uint8Array(32)
  crypto.getRandomValues(ephemeralKey)

  const { envelope } = await createSecureEnvelope(
    {
      plaintext: params.plaintext,
      policyClient: params.policyClient,
      chainId: params.chainId,
      recipientPublicKey,
    },
    ephemeralKey,
  )

  zeroize(ephemeralKey)

  const rpcRequest: StoreEncryptedSecretsRpcRequest = {
    policy_client: params.policyClient,
    policy_data_address: params.policyDataAddress,
    envelope: JSON.stringify(envelope),
    chain_id: params.chainId,
  }

  const avsHttpService = new AvsHttpService(chainId, gatewayApiUrlOverride)
  const res = await avsHttpService.Post(GATEWAY_METHODS.storeEncryptedSecrets, rpcRequest, apiKey)
  if (res.error) throw res.error
  return res.result as StoreEncryptedSecretsResponse
}

/**
 * Compute dual Ed25519 signatures for privacy-enabled task creation.
 *
 * Dual signatures prevent the app from forging user authorization, and ensure
 * the app explicitly acknowledges which encrypted data refs are being used.
 * The gateway validates both when `encrypted_data_refs` are present in `newt_createTask`.
 *
 * Signature scheme (must match `crates/gateway/src/processor/privacy_auth.rs`):
 * - User signs: keccak256(abi.encodePacked(policy_client, intent_hash, ref_id_1, ref_id_2, ...))
 * - App signs: keccak256(abi.encodePacked(policy_client, intent_hash, user_signature))
 *
 * This is a pure offline function — zero network calls.
 */
export function signPrivacyAuthorization(params: SignPrivacyAuthorizationParams): PrivacyAuthorizationResult {
  const { policyClient, intentHash, encryptedDataRefs, userSigningKey, appSigningKey } = params

  const policyClientBytes = hexToBytes(ensureHexPrefix(policyClient))
  const intentHashBytes = hexToBytes(ensureHexPrefix(intentHash))

  // Build user message: encodePacked(policy_client, intent_hash, ref_ids...)
  const userParts: Uint8Array[] = [policyClientBytes, intentHashBytes]
  for (const refId of encryptedDataRefs) {
    userParts.push(new TextEncoder().encode(refId))
  }
  const userMessage = concatBytes(userParts)
  const userDigest = hexToBytes(keccak256(userMessage))

  // User signs the digest
  const userKeyBytes = hexToBytes(ensureHexPrefix(userSigningKey))
  const userSignature = ed25519.sign(userDigest, userKeyBytes)
  const userPublicKey = ed25519.getPublicKey(userKeyBytes)
  zeroize(userKeyBytes)

  // Build app message: encodePacked(policy_client, intent_hash, user_signature)
  const appMessage = concatBytes([policyClientBytes, intentHashBytes, userSignature])
  const appDigest = hexToBytes(keccak256(appMessage))

  // App signs the digest
  const appKeyBytes = hexToBytes(ensureHexPrefix(appSigningKey))
  const appSignature = ed25519.sign(appDigest, appKeyBytes)
  const appPublicKey = ed25519.getPublicKey(appKeyBytes)
  zeroize(appKeyBytes)

  return {
    userSignature: bytesToUnprefixedHex(userSignature),
    appSignature: bytesToUnprefixedHex(appSignature),
    userPublicKey: bytesToUnprefixedHex(userPublicKey),
    appPublicKey: bytesToUnprefixedHex(appPublicKey),
  }
}

/**
 * Upload HPKE-encrypted confidential data (blacklists, allowlists, sanctions lists, etc.)
 * to the gateway.
 *
 * The provider encrypts data client-side using HPKE and uploads the envelope.
 * The gateway stores it and returns a content-hash data_ref_id. The provider
 * then calls ConfidentialDataRegistry.publishData(domain, dataRefId) on-chain.
 *
 * If recipientPublicKey is not provided, it is fetched from the gateway first
 * via newt_getPrivacyPublicKey.
 */
export async function uploadConfidentialData(
  chainId: number,
  apiKey: string,
  params: UploadConfidentialDataParams,
  gatewayApiUrlOverride?: string,
): Promise<UploadConfidentialDataResult> {
  // Resolve the gateway's HPKE public key if not provided
  let recipientPublicKey = params.recipientPublicKey
  if (!recipientPublicKey) {
    const keyResponse = await getPrivacyPublicKey(chainId, apiKey, gatewayApiUrlOverride)
    recipientPublicKey = keyResponse.public_key
  }

  // Ephemeral Ed25519 key for envelope signing (not used for auth).
  // Auth: gateway validates provider via on-chain ConfidentialDataRegistry, not this signature.
  const ephemeralKey = new Uint8Array(32)
  crypto.getRandomValues(ephemeralKey)

  // Use provider address as policyClient for AAD binding
  const { envelope } = await createSecureEnvelope(
    {
      plaintext: params.plaintext,
      policyClient: params.provider as `0x${string}`,
      chainId: params.chainId,
      recipientPublicKey,
    },
    ephemeralKey,
  )

  // Zeroize the ephemeral signing key
  ephemeralKey.fill(0)

  const rpcRequest: UploadConfidentialDataRpcRequest = {
    provider: params.provider,
    domain: params.domain,
    envelope: JSON.stringify(envelope),
    chain_id: params.chainId,
  }

  const avsHttpService = new AvsHttpService(chainId, gatewayApiUrlOverride)
  const res = await avsHttpService.Post(GATEWAY_METHODS.uploadConfidentialData, rpcRequest, apiKey)
  if (res.error) throw res.error
  return res.result as UploadConfidentialDataResult
}

/**
 * Retrieve encrypted confidential data by its data reference ID.
 *
 * Returns the HPKE-encrypted envelope along with the domain and provider address.
 * The caller is responsible for decryption using their HPKE private key.
 */
export async function getConfidentialData(
  chainId: number,
  apiKey: string,
  dataRefId: string,
  gatewayApiUrlOverride?: string,
): Promise<GetConfidentialDataResult> {
  const avsHttpService = new AvsHttpService(chainId, gatewayApiUrlOverride)
  const res = await avsHttpService.Post(GATEWAY_METHODS.getConfidentialData, { data_ref_id: dataRefId }, apiKey)
  if (res.error) throw res.error
  return res.result as GetConfidentialDataResult
}

/**
 * Concatenate multiple Uint8Arrays into one.
 */
function concatBytes(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}
