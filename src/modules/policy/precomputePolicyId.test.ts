import type { PolicyParamsJson } from '@core/types/policy'
import { describe, expect, it } from 'vitest'
import { policyReadFunctions } from './index'

const { precomputePolicyId } = policyReadFunctions

describe('precomputePolicyId', () => {
  const baseArgs = {
    publicClient: {} as Parameters<typeof precomputePolicyId>[0]['publicClient'],
    policyContractAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    policyContract: '0x1111111111111111111111111111111111111111' as `0x${string}`,
    policyData: ['0x2222222222222222222222222222222222222222' as `0x${string}`],
    params: {
      admin: '0x3333333333333333333333333333333333333333',
      allowed_actions: {},
      token_whitelist: {},
    } satisfies PolicyParamsJson,
    client: '0x3333333333333333333333333333333333333333' as `0x${string}`,
    policyUri: 'ipfs://QmTest',
    schemaUri: 'ipfs://QmSchema',
    entrypoint: 'main',
    blockTimestamp: 1700000000n,
  }

  // viem's encodePacked does not support tuple types, so precomputePolicyId
  // currently throws. These tests document the expected error behavior.
  // When the SDK migrates to encodeAbiParameters or a custom encoding,
  // these tests should be updated to assert the happy path.

  it('throws with packed encoding error for tuple type', () => {
    expect(() => precomputePolicyId(baseArgs)).toThrow('Failed to precompute policy ID')
  })

  it('wraps the viem error in an SDK error', () => {
    expect(() => precomputePolicyId(baseArgs)).toThrow('Newton SDK:')
  })

  it('includes the viem error detail', () => {
    expect(() => precomputePolicyId(baseArgs)).toThrow('tuple(bytes,uint32)')
  })
})
