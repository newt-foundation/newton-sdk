import { IDENTITY_REGISTRY } from '@core/const'
import { SDKErrorCode } from '@core/types/core/exception-types'
import type { Address } from 'viem'
import { keccak256, toBytes } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { identityDomainHash, sendIdentityEncrypted } from './index'

vi.mock('@core/utils/https', () => ({
  AvsHttpService: vi.fn().mockImplementation(() => ({
    Post: vi.fn().mockResolvedValue({
      result: { inclusion_tx: '0xtxhash123' },
    }),
  })),
}))

const TEST_IDENTITY_OWNER: Address = '0x1234567890abcdef1234567890abcdef12345678'

describe('identity module', () => {
  describe('identityDomainHash', () => {
    it('returns keccak256 of the domain name bytes', () => {
      const result = identityDomainHash('kyc')
      expect(result).toBe(keccak256(toBytes('kyc')))
    })

    it('produces different hashes for different domains', () => {
      const kycHash = identityDomainHash('kyc')
      const accreditationHash = identityDomainHash('accreditation')
      expect(kycHash).not.toBe(accreditationHash)
    })

    it('is deterministic', () => {
      expect(identityDomainHash('kyc')).toBe(identityDomainHash('kyc'))
    })
  })

  describe('sendIdentityEncrypted', () => {
    const baseParams = {
      identityOwner: TEST_IDENTITY_OWNER,
      identityData: 'encrypted-blob-data',
      identityDomain: 'kyc' as const,
    }

    it('throws MissingChain when walletClient has no chain', async () => {
      const walletClient = { chain: undefined, account: { address: TEST_IDENTITY_OWNER } } as any

      await expect(sendIdentityEncrypted(walletClient, baseParams, 'test-api-key')).rejects.toThrow(
        expect.objectContaining({
          code: SDKErrorCode.MissingChain,
        }),
      )
    })

    it('throws MissingAccount when walletClient has no account', async () => {
      const walletClient = { chain: { id: 11155111 }, account: undefined } as any

      await expect(sendIdentityEncrypted(walletClient, baseParams, 'test-api-key')).rejects.toThrow(
        expect.objectContaining({
          code: SDKErrorCode.MissingAccount,
        }),
      )
    })

    it('throws InvalidAddress for invalid identityOwner', async () => {
      const walletClient = {
        chain: { id: 11155111 },
        account: { address: TEST_IDENTITY_OWNER },
      } as any

      await expect(
        sendIdentityEncrypted(walletClient, { ...baseParams, identityOwner: '0xinvalid' as Address }, 'test-api-key'),
      ).rejects.toThrow(
        expect.objectContaining({
          code: SDKErrorCode.InvalidAddress,
        }),
      )
    })

    it('throws when no IdentityRegistry address for unsupported chain', async () => {
      const walletClient = {
        chain: { id: 999999 },
        account: { address: TEST_IDENTITY_OWNER },
      } as any

      await expect(sendIdentityEncrypted(walletClient, baseParams, 'test-api-key')).rejects.toThrow(
        expect.objectContaining({
          code: SDKErrorCode.InvalidAddress,
        }),
      )
    })

    it('throws IdentityOwnerMismatch when signer does not match owner', async () => {
      const differentSigner: Address = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
      const walletClient = {
        chain: { id: 11155111 },
        account: { address: differentSigner },
      } as any

      await expect(sendIdentityEncrypted(walletClient, baseParams, 'test-api-key')).rejects.toThrow(
        expect.objectContaining({
          code: SDKErrorCode.IdentityOwnerMismatch,
        }),
      )
    })

    it('uses deployed IdentityRegistry address and submits to gateway', async () => {
      const mockSignature = '0xabcd' as const
      const mockSignTypedData = vi.fn().mockResolvedValue(mockSignature)

      const walletClient = {
        chain: { id: 11155111 },
        account: { address: TEST_IDENTITY_OWNER },
        signTypedData: mockSignTypedData,
      } as any

      const result = await sendIdentityEncrypted(walletClient, baseParams, 'test-api-key')

      expect(mockSignTypedData).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: expect.objectContaining({
            name: 'IdentityRegistry',
            version: '1',
            chainId: BigInt(11155111),
            verifyingContract: IDENTITY_REGISTRY[11155111],
          }),
          primaryType: 'EncryptedIdentityData',
          message: { data: 'encrypted-blob-data' },
        }),
      )

      expect(result.inclusion_tx).toBe('0xtxhash123')
    })
  })
})
