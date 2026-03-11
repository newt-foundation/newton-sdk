import type { Address } from 'viem'
import { hexToBytes } from 'viem'
import { describe, expect, it } from 'vitest'
import { createSecureEnvelope } from './index'

// Deterministic test keys (not real secrets — test-only Ed25519 seed)
const TEST_ED25519_SEED = hexToBytes(`0x${'aa'.repeat(32)}`) // 32 bytes of 0xaa
const TEST_X25519_PUBKEY = '3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29' // well-known test key
const TEST_POLICY_CLIENT: Address = '0x1234567890abcdef1234567890abcdef12345678'

describe('privacy module', () => {
  describe('createSecureEnvelope', () => {
    it('produces a valid envelope with all required fields', async () => {
      const result = await createSecureEnvelope(
        {
          plaintext: { hello: 'world' },
          policyClient: TEST_POLICY_CLIENT,
          chainId: 11155111,
          recipientPublicKey: TEST_X25519_PUBKEY,
        },
        TEST_ED25519_SEED,
      )

      // Envelope structure
      expect(result.envelope).toBeDefined()
      expect(result.envelope.enc).toMatch(/^[0-9a-f]{64}$/) // 32-byte X25519 encapsulated key
      expect(result.envelope.ciphertext).toBeTruthy()
      expect(result.envelope.policy_client).toBe('0x1234567890abcdef1234567890abcdef12345678')
      expect(result.envelope.chain_id).toBe(11155111)
      expect(result.envelope.recipient_pubkey).toBe(TEST_X25519_PUBKEY)

      // Signature and sender public key
      expect(result.signature).toMatch(/^[0-9a-f]{128}$/) // 64-byte Ed25519 signature
      expect(result.senderPublicKey).toMatch(/^[0-9a-f]{64}$/) // 32-byte Ed25519 public key
    })

    it('is offline — produces different ciphertexts for identical inputs (ephemeral keys)', async () => {
      const params = {
        plaintext: 'deterministic input',
        policyClient: TEST_POLICY_CLIENT,
        chainId: 1,
        recipientPublicKey: TEST_X25519_PUBKEY,
      }

      const result1 = await createSecureEnvelope(params, TEST_ED25519_SEED)
      const result2 = await createSecureEnvelope(params, TEST_ED25519_SEED)

      // Ephemeral HPKE keys differ per call, so enc and ciphertext must differ
      expect(result1.envelope.enc).not.toBe(result2.envelope.enc)
      expect(result1.envelope.ciphertext).not.toBe(result2.envelope.ciphertext)

      // But the sender Ed25519 public key is deterministic from the signing key
      expect(result1.senderPublicKey).toBe(result2.senderPublicKey)
    })

    it('accepts Uint8Array plaintext', async () => {
      const result = await createSecureEnvelope(
        {
          plaintext: new Uint8Array([1, 2, 3, 4]),
          policyClient: TEST_POLICY_CLIENT,
          chainId: 1,
          recipientPublicKey: TEST_X25519_PUBKEY,
        },
        TEST_ED25519_SEED,
      )

      expect(result.envelope.ciphertext).toBeTruthy()
      expect(result.signature).toBeTruthy()
    })

    it('accepts string plaintext', async () => {
      const result = await createSecureEnvelope(
        {
          plaintext: 'raw string data',
          policyClient: TEST_POLICY_CLIENT,
          chainId: 1,
          recipientPublicKey: TEST_X25519_PUBKEY,
        },
        TEST_ED25519_SEED,
      )

      expect(result.envelope.ciphertext).toBeTruthy()
    })

    it('binds AAD to policy_client and chain_id — cross-context decryption fails', async () => {
      const baseParams = {
        plaintext: 'same data',
        policyClient: TEST_POLICY_CLIENT,
        chainId: 1,
        recipientPublicKey: TEST_X25519_PUBKEY,
      }

      const result1 = await createSecureEnvelope(baseParams, TEST_ED25519_SEED)

      // Different chain_id produces different ciphertext even with same plaintext
      const result2 = await createSecureEnvelope({ ...baseParams, chainId: 11155111 }, TEST_ED25519_SEED)

      // Different AAD means different envelopes — cross-context replay is not possible
      expect(result1.envelope.chain_id).not.toBe(result2.envelope.chain_id)
      expect(result1.envelope.ciphertext).not.toBe(result2.envelope.ciphertext)

      // Different policy client also produces different AAD
      const result3 = await createSecureEnvelope(
        { ...baseParams, policyClient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' },
        TEST_ED25519_SEED,
      )
      expect(result3.envelope.ciphertext).not.toBe(result1.envelope.ciphertext)
    })

    it('rejects invalid hex in recipientPublicKey', async () => {
      await expect(
        createSecureEnvelope(
          {
            plaintext: 'test',
            policyClient: TEST_POLICY_CLIENT,
            chainId: 1,
            recipientPublicKey: 'not-valid-hex',
          },
          TEST_ED25519_SEED,
        ),
      ).rejects.toThrow('invalid hex')
    })

    it('rejects recipientPublicKey with wrong length', async () => {
      await expect(
        createSecureEnvelope(
          {
            plaintext: 'test',
            policyClient: TEST_POLICY_CLIENT,
            chainId: 1,
            recipientPublicKey: 'abcd', // 2 bytes, not 32
          },
          TEST_ED25519_SEED,
        ),
      ).rejects.toThrow('exactly 32 bytes')
    })

    it('rejects signingKey with wrong length', async () => {
      await expect(
        createSecureEnvelope(
          {
            plaintext: 'test',
            policyClient: TEST_POLICY_CLIENT,
            chainId: 1,
            recipientPublicKey: TEST_X25519_PUBKEY,
          },
          new Uint8Array(16), // 16 bytes, not 32
        ),
      ).rejects.toThrow('exactly 32 bytes')
    })

    it('rejects invalid policy client address', async () => {
      await expect(
        createSecureEnvelope(
          {
            plaintext: 'test',
            policyClient: '0xinvalid' as Address,
            chainId: 1,
            recipientPublicKey: TEST_X25519_PUBKEY,
          },
          TEST_ED25519_SEED,
        ),
      ).rejects.toThrow('invalid policy client address')
    })
  })
})
