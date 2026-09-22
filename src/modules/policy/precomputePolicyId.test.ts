import type { PolicySpec } from '@core/types/policy'
import { describe, expect, it } from 'vitest'
import { policyReadFunctions } from './index'

const { precomputePolicyId } = policyReadFunctions

const CLIENT = '0x65cC59Bb687884657b0bF772736a934Da7Bd4f10' as const
const POLICY_A = '0x5c141295bAE0c15B9FfC712288bebFBbA8e1161d' as const
const POLICY_B = '0xBf62A2aD1837573CBd77b308639D014eE72202bE' as const

const SEPOLIA_PARAMS =
  '0x7b0a20202261646d696e223a2022307830303030303030303030303030303030303030303030303030303030303030303030303030303031222c0a202022616c6c6f7765645f636861696e5f696473223a205b223131313535313131225d2c0a202022616c6c6f7765645f636f6e747261637473223a205b22307862316164356638323430376263306631396634326232363134666239303833303335613336623639225d2c0a202022616c6c6f7765645f66756e6374696f6e73223a205b22627579225d0a7d0a' as const
const BASE_SEPOLIA_PARAMS =
  '0x7b0a20202261646d696e223a2022307830303030303030303030303030303030303030303030303030303030303030303030303030303031222c0a202022616c6c6f7765645f636861696e5f696473223a205b223834353332225d2c0a202022616c6c6f7765645f636f6e747261637473223a205b22307862316164356638323430376263306631396634326232363134666239303833303335613336623639225d2c0a202022616c6c6f7765645f66756e6374696f6e73223a205b22627579225d0a7d0a' as const

const spec = (policy: `0x${string}`, expireAfter = 300, params = '0x' as `0x${string}`): PolicySpec => ({
  policy,
  config: { policyParams: params, expireAfter },
})

describe('precomputePolicyId', () => {
  // Captured from deployed clients: the id these contracts actually report on chain.
  it.each([
    {
      name: 'sepolia',
      chainId: 11155111,
      client: CLIENT,
      revision: 1,
      policy: POLICY_A,
      params: SEPOLIA_PARAMS,
      expected: '0x2e78001a701a467f2d0ab98cffc17c8d38bdc1a5ba4fadcda4761c3891a4325b',
    },
    {
      name: 'base sepolia',
      chainId: 84532,
      client: '0xBd8184081AAafE7673d9a8dB80dFF2b56BA960EB',
      revision: 1,
      policy: POLICY_B,
      params: BASE_SEPOLIA_PARAMS,
      expected: '0xcffed78f4b870b4d41ba0c95b93665f717684d37a29229774b26fe19f6d7a0c1',
    },
  ] as const)('matches the on-chain id for $name', ({ chainId, client, revision, policy, params, expected }) => {
    expect(precomputePolicyId({ chainId, client, revision, policies: [spec(policy, 300, params)] })).toBe(expected)
  })

  it('is order sensitive', () => {
    const forward = precomputePolicyId({
      chainId: 84532,
      client: CLIENT,
      revision: 2,
      policies: [spec(POLICY_A), spec(POLICY_B)],
    })
    const reversed = precomputePolicyId({
      chainId: 84532,
      client: CLIENT,
      revision: 2,
      policies: [spec(POLICY_B), spec(POLICY_A)],
    })
    expect(forward).not.toBe(reversed)
  })

  it('distinguishes a repeated policy from a single one', () => {
    const once = precomputePolicyId({ chainId: 84532, client: CLIENT, revision: 1, policies: [spec(POLICY_A)] })
    const twice = precomputePolicyId({
      chainId: 84532,
      client: CLIENT,
      revision: 1,
      policies: [spec(POLICY_A), spec(POLICY_A)],
    })
    expect(once).not.toBe(twice)
  })

  it('binds chainId, client and revision', () => {
    const policies = [spec(POLICY_A)]
    const base = precomputePolicyId({ chainId: 1, client: CLIENT, revision: 1, policies })
    expect(precomputePolicyId({ chainId: 8453, client: CLIENT, revision: 1, policies })).not.toBe(base)
    expect(precomputePolicyId({ chainId: 1, client: POLICY_B, revision: 1, policies })).not.toBe(base)
    expect(precomputePolicyId({ chainId: 1, client: CLIENT, revision: 2, policies })).not.toBe(base)
  })

  it('binds policyParams and expireAfter', () => {
    const base = precomputePolicyId({ chainId: 1, client: CLIENT, revision: 1, policies: [spec(POLICY_A, 300)] })
    expect(precomputePolicyId({ chainId: 1, client: CLIENT, revision: 1, policies: [spec(POLICY_A, 301)] })).not.toBe(
      base,
    )
    expect(
      precomputePolicyId({
        chainId: 1,
        client: CLIENT,
        revision: 1,
        policies: [spec(POLICY_A, 300, '0x7b2261223a317d')],
      }),
    ).not.toBe(base)
  })
})
