import type { Address, Hex } from 'viem'
import { describe, expectTypeOf, it } from 'vitest'
import type { newtonPublicClientActions, newtonWalletClientActions } from './index'
import type { SimulatePolicyResult, SimulateTaskResult, TaskResponseResult, TaskStatus } from './types/task'

// Simulate the shape returned by client.extend()
type PublicActions = ReturnType<ReturnType<typeof newtonPublicClientActions>>
type WalletActions = ReturnType<ReturnType<typeof newtonWalletClientActions>>

describe('newtonPublicClientActions type tests', () => {
  it('waitForTaskResponded returns TaskResponseResult', () => {
    expectTypeOf<PublicActions['waitForTaskResponded']>().returns.resolves.toEqualTypeOf<TaskResponseResult>()
  })

  it('getTaskResponseHash returns Hex or null', () => {
    expectTypeOf<PublicActions['getTaskResponseHash']>().returns.resolves.toEqualTypeOf<Hex | null>()
  })

  it('getTaskStatus returns TaskStatus', () => {
    expectTypeOf<PublicActions['getTaskStatus']>().returns.resolves.toEqualTypeOf<TaskStatus>()
  })

  it('getPolicyId returns hex string', () => {
    expectTypeOf<PublicActions['getPolicyId']>().returns.resolves.toEqualTypeOf<`0x${string}`>()
  })

  it('owner returns Address', () => {
    expectTypeOf<PublicActions['owner']>().returns.resolves.toEqualTypeOf<Address>()
  })

  it('factory returns Address', () => {
    expectTypeOf<PublicActions['factory']>().returns.resolves.toEqualTypeOf<Address>()
  })

  it('isPolicyVerified returns boolean', () => {
    expectTypeOf<PublicActions['isPolicyVerified']>().returns.resolves.toEqualTypeOf<boolean>()
  })

  it('getPolicyData returns Address array', () => {
    expectTypeOf<PublicActions['getPolicyData']>().returns.resolves.toEqualTypeOf<Address[]>()
  })

  it('precomputePolicyId is synchronous and returns string (PolicyId)', () => {
    expectTypeOf<PublicActions['precomputePolicyId']>().returns.toEqualTypeOf<string>()
  })
})

describe('newtonWalletClientActions type tests', () => {
  it('simulateTask returns SimulateTaskResult', () => {
    expectTypeOf<WalletActions['simulateTask']>().returns.resolves.toEqualTypeOf<SimulateTaskResult>()
  })

  it('simulatePolicy returns SimulatePolicyResult', () => {
    expectTypeOf<WalletActions['simulatePolicy']>().returns.resolves.toEqualTypeOf<SimulatePolicyResult>()
  })

  it('initialize returns transaction hash', () => {
    expectTypeOf<WalletActions['initialize']>().returns.resolves.toEqualTypeOf<`0x${string}`>()
  })

  it('renounceOwnership returns transaction hash', () => {
    expectTypeOf<WalletActions['renounceOwnership']>().returns.resolves.toEqualTypeOf<`0x${string}`>()
  })

  it('transferOwnership returns transaction hash', () => {
    expectTypeOf<WalletActions['transferOwnership']>().returns.resolves.toEqualTypeOf<`0x${string}`>()
  })
})
