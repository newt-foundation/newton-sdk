import { keccak256, toBytes } from 'viem'
import { describe, expect, it } from 'vitest'
import { identityDomainHash } from './index'

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
})
