/**
 * Newton Privacy Module — Client-side HPKE encryption for privacy-preserving policy evaluation.
 *
 * Encryption suite: X25519 KEM + HKDF-SHA256 + ChaCha20-Poly1305 (RFC 9180, Base mode).
 * Compatible with the Rust gateway's `crates/core/src/crypto/hpke.rs`.
 *
 * Key design constraints (NEWT-627):
 * - Zero network calls during encrypt/createSecureEnvelope
 * - Offline capable once the gateway public key is known
 * - Ephemeral keys zeroed after encryption
 */

import { GATEWAY_METHODS } from '@core/const'
import type {
  CreateSecureEnvelopeParams,
  PrivacyPublicKeyResponse,
  SecureEnvelope,
  SecureEnvelopeResult,
  UploadEncryptedDataParams,
  UploadEncryptedDataResponse,
  UploadEncryptedDataRpcRequest,
} from '@core/types/privacy'
import { AvsHttpService } from '@core/utils/https'
import { Chacha20Poly1305 } from '@hpke/chacha20poly1305'
import { CipherSuite, DhkemX25519HkdfSha256, HkdfSha256 } from '@hpke/core'
import { ed25519 } from '@noble/curves/ed25519.js'
import { keccak256 } from 'viem'

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

function toBytes(input: Uint8Array | string | Record<string, unknown>): Uint8Array {
  if (input instanceof Uint8Array) return input
  const str = typeof input === 'string' ? input : JSON.stringify(input)
  return new TextEncoder().encode(str)
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  if (clean.length % 2 !== 0) throw new Error('hex string must have even length')
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = Number.parseInt(clean.substring(i, i + 2), 16)
  }
  return bytes
}

/**
 * Compute AAD as keccak256(abi.encodePacked(policy_client_bytes, chain_id_be_bytes)).
 * Must match the Rust implementation in `crates/core/src/crypto/envelope.rs`.
 */
function computeAad(policyClient: string, chainId: number): Uint8Array {
  const clientBytes = hexToBytes(policyClient)
  // chain_id as big-endian u64 (8 bytes)
  const chainIdBytes = new Uint8Array(8)
  const view = new DataView(chainIdBytes.buffer)
  // Use two 32-bit writes for full u64 range without BigInt
  view.setUint32(0, Math.floor(chainId / 0x100000000))
  view.setUint32(4, chainId >>> 0)

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
 * @param params - Encryption parameters
 * @param signingKey - Ed25519 private key seed (32 bytes, hex-encoded, no 0x prefix)
 * @returns Envelope + Ed25519 signature over the serialized envelope
 */
export async function createSecureEnvelope(
  params: CreateSecureEnvelopeParams,
  signingKey: string,
): Promise<SecureEnvelopeResult> {
  const { policyClient, chainId, recipientPublicKey } = params
  const plaintext = toBytes(params.plaintext)

  // Compute AAD (matches Rust: keccak256(abi.encodePacked(policy_client, chain_id)))
  const aad = computeAad(policyClient, chainId)

  // Deserialize recipient's X25519 public key
  const recipientPkBytes = hexToBytes(recipientPublicKey)
  const recipientKey = await suite.kem.deserializePublicKey(recipientPkBytes)

  // HPKE single-shot seal (Base mode, empty info)
  const sender = await suite.createSenderContext({ recipientPublicKey: recipientKey, info: new Uint8Array(0) })
  const ciphertext = await sender.seal(plaintext, aad)

  // Extract the encapsulated key
  const encBytes = new Uint8Array(sender.enc)

  // Build the envelope
  const envelope: SecureEnvelope = {
    enc: bytesToHex(encBytes),
    ciphertext: bytesToHex(new Uint8Array(ciphertext)),
    policy_client: policyClient,
    chain_id: chainId,
    recipient_pubkey: recipientPublicKey,
  }

  // Sign the serialized envelope with Ed25519
  const signingKeyBytes = hexToBytes(signingKey)
  const envelopeJson = JSON.stringify(envelope)
  const envelopeBytes = new TextEncoder().encode(envelopeJson)
  const signature = ed25519.sign(envelopeBytes, signingKeyBytes)
  const senderPublicKey = ed25519.getPublicKey(signingKeyBytes)

  // Zeroize ephemeral key material
  zeroize(signingKeyBytes)

  return {
    envelope,
    signature: bytesToHex(signature),
    senderPublicKey: bytesToHex(senderPublicKey),
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
 * Encrypt data and upload to the gateway in a single call.
 *
 * Combines createSecureEnvelope + RPC upload. If recipientPublicKey is not
 * provided, it is fetched from the gateway first via newt_getPrivacyPublicKey.
 */
export async function uploadEncryptedData(
  chainId: number,
  apiKey: string,
  params: UploadEncryptedDataParams,
  gatewayApiUrlOverride?: string,
): Promise<UploadEncryptedDataResponse> {
  // Resolve the gateway's public key if not provided
  let recipientPublicKey = params.recipientPublicKey
  if (!recipientPublicKey) {
    const keyResponse = await getPrivacyPublicKey(chainId, apiKey, gatewayApiUrlOverride)
    recipientPublicKey = keyResponse.public_key
  }

  // Create the secure envelope (offline HPKE encryption + Ed25519 signing)
  const { envelope, signature, senderPublicKey } = await createSecureEnvelope(
    {
      plaintext: params.plaintext,
      policyClient: params.policyClient,
      chainId: params.chainId,
      recipientPublicKey,
    },
    params.signingKey,
  )

  // Build the RPC request matching gateway's UploadEncryptedDataRequest
  const rpcRequest: UploadEncryptedDataRpcRequest = {
    sender_address: params.senderAddress,
    policy_client: params.policyClient,
    envelope: JSON.stringify(envelope),
    signature,
    sender_pubkey: senderPublicKey,
    ttl: params.ttl ?? null,
    chain_id: params.chainId,
  }

  const avsHttpService = new AvsHttpService(chainId, gatewayApiUrlOverride)
  const res = await avsHttpService.Post(GATEWAY_METHODS.uploadEncryptedData, rpcRequest, apiKey)
  if (res.error) throw res.error
  return res.result as UploadEncryptedDataResponse
}
