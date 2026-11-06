import type { IntentFromParams } from '@core/types/task'
import {
  type Address,
  type Hex,
  createWalletClient,
  custom,
  encodeFunctionResult,
  recoverTypedDataAddress,
  stringToHex,
  toHex,
  zeroHash,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import { delegatedIntentTypedData } from '../delegator'
import { type PolicyClientDomain, intentTypedData, signIntent } from './index'

const holder = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
const POLICY_CLIENT: Address = '0x1111111111111111111111111111111111111111'
const VAULT: Address = '0x2222222222222222222222222222222222222222'

// a gateway task: the intent calls a vault, gated by a separate policy client
const intent: IntentFromParams = {
  from: holder.address,
  to: VAULT,
  value: 0n,
  data: '0xdeadbeef',
  chainId: sepolia.id,
  functionSignature: stringToHex('deposit(uint256)'),
}

const EIP712_DOMAIN_ABI = [
  {
    type: 'function',
    name: 'eip712Domain',
    inputs: [],
    outputs: [
      { name: 'fields', type: 'bytes1' },
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
      { name: 'salt', type: 'bytes32' },
      { name: 'extensions', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
] as const

/** A wallet whose chain answers `eip712Domain()` for each policy client in `domains`. */
const walletWithDomains = (domains: Record<Address, Omit<PolicyClientDomain, 'verifyingContract'>>) => {
  const calls: Address[] = []
  const wallet = createWalletClient({
    account: holder,
    chain: sepolia,
    transport: custom({
      request: async ({ method, params }) => {
        if (method === 'eth_chainId') return toHex(sepolia.id)
        if (method === 'eth_call') {
          const to = (params[0] as { to: Address }).to.toLowerCase() as Address
          calls.push(to)
          const domain = Object.entries(domains).find(([address]) => address.toLowerCase() === to)?.[1]
          if (!domain) throw new Error(`no eip712Domain at ${to}`)
          return encodeFunctionResult({
            abi: EIP712_DOMAIN_ABI,
            functionName: 'eip712Domain',
            result: ['0x0f', domain.name, domain.version, domain.chainId, to, zeroHash, []],
          })
        }
        throw new Error(`unexpected ${method}`)
      },
    }),
  })
  return { wallet, calls }
}

const policyClientDomain: PolicyClientDomain = {
  name: 'NewtonPolicyClient',
  version: '1',
  chainId: BigInt(sepolia.id),
  verifyingContract: POLICY_CLIENT,
}

describe('signIntent', () => {
  it('signs under the policy client domain when intent.to is another contract', async () => {
    const { wallet, calls } = walletWithDomains({ [POLICY_CLIENT]: policyClientDomain })
    const signature: Hex = await signIntent(wallet, { policyClient: POLICY_CLIENT, intent })

    expect(calls).toEqual([POLICY_CLIENT])
    const recovered = await recoverTypedDataAddress({ ...intentTypedData(intent, policyClientDomain), signature })
    expect(recovered).toBe(holder.address)

    // the delegated-intent domain (verifyingContract = intent.to) recovers someone else
    const underIntentTo = await recoverTypedDataAddress({ ...delegatedIntentTypedData(intent), signature })
    expect(underIntentTo).not.toBe(holder.address)
  })

  it('uses the name and version the policy client reports', async () => {
    const custom = { name: 'MyVaultGuard', version: '2', chainId: BigInt(sepolia.id) }
    const { wallet } = walletWithDomains({ [POLICY_CLIENT]: custom })
    const signature = await signIntent(wallet, { policyClient: POLICY_CLIENT, intent })

    const recovered = await recoverTypedDataAddress({
      ...intentTypedData(intent, { ...custom, verifyingContract: POLICY_CLIENT }),
      signature,
    })
    expect(recovered).toBe(holder.address)
  })

  it('accepts hex value and chainId', async () => {
    const { wallet } = walletWithDomains({ [POLICY_CLIENT]: policyClientDomain })
    const hexIntent = { ...intent, value: toHex(0n), chainId: toHex(sepolia.id) }
    const signature = await signIntent(wallet, { policyClient: POLICY_CLIENT, intent: hexIntent })

    const recovered = await recoverTypedDataAddress({ ...intentTypedData(intent, policyClientDomain), signature })
    expect(recovered).toBe(holder.address)
  })

  it('refuses an intent from another address before reading the chain', async () => {
    const { wallet, calls } = walletWithDomains({ [POLICY_CLIENT]: policyClientDomain })
    await expect(
      signIntent(wallet, { policyClient: POLICY_CLIENT, intent: { ...intent, from: VAULT } }),
    ).rejects.toThrow(/does not match/)
    expect(calls).toEqual([])
  })
})
