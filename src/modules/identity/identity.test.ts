import { type Hex, keccak256, toBytes } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { identityDomainHash, registerIdentityData } from './index'

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

  describe('registerIdentityData', () => {
    it('calls writeContract with correct ABI function and args', async () => {
      const mockWriteContract = vi.fn().mockResolvedValue('0xtxhash')
      const walletClient = {
        chain: { id: 11155111 },
        account: { address: '0x1234567890abcdef1234567890abcdef12345678' },
        writeContract: mockWriteContract,
      } as any

      const params = {
        identityDomain: identityDomainHash('kyc'),
        dataRefId: 'QmTestDataRefId123',
        gatewaySignature: '0xabcdef' as Hex,
        deadline: 1700000000n,
      }

      const result = await registerIdentityData(walletClient, params)

      expect(result).toBe('0xtxhash')
      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'registerIdentityData',
          args: [params.identityDomain, params.dataRefId, params.gatewaySignature, params.deadline],
        }),
      )
    })

    it('throws MissingChain when walletClient has no chain', async () => {
      const walletClient = {
        chain: undefined,
        account: { address: '0x1234567890abcdef1234567890abcdef12345678' },
      } as any

      await expect(
        registerIdentityData(walletClient, {
          identityDomain: '0x00' as Hex,
          dataRefId: 'test',
          gatewaySignature: '0x00' as Hex,
          deadline: 0n,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: 'MISSING_CHAIN' }))
    })

    it('throws InvalidAddress for unsupported chain', async () => {
      const walletClient = {
        chain: { id: 999999 },
        account: { address: '0x1234567890abcdef1234567890abcdef12345678' },
      } as any

      await expect(
        registerIdentityData(walletClient, {
          identityDomain: '0x00' as Hex,
          dataRefId: 'test',
          gatewaySignature: '0x00' as Hex,
          deadline: 0n,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: 'INVALID_ADDRESS' }))
    })
  })
})
