import { NewtonPolicyAbi, NewtonPolicyClientAbi, NewtonPolicyFactoryAbi } from '@core/abis/newtonPolicyAbi'
import { POLICY_SET_DOMAIN } from '@core/types/policy'
import type { PolicyId, PolicySpec } from '@core/types/policy'
import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  encodeAbiParameters,
  fromHex,
  keccak256,
} from 'viem'

// Read function wrappers - exact same names as on-chain functions

const getPolicyId = async ({
  publicClient,
  policyContractAddress,
  client,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
  client: Address
}): Promise<`0x${string}`> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'getPolicyId',
      args: [client],
    })
    return result as `0x${string}`
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getPolicyId - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const getPolicyConfig = async ({
  publicClient,
  policyContractAddress,
  policyId,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
  policyId: `0x${string}`
}): Promise<{ policyParams: string | object; policyParamsHex: `0x${string}`; expireAfter: number }> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'getPolicyConfig',
      args: [policyId],
    })
    // Hex decode result.policyParams
    const policyParams = fromHex(result.policyParams, 'string')
    let policyParamsObject = undefined
    try {
      policyParamsObject = JSON.parse(policyParams)
    } catch (_error) {
      policyParamsObject = policyParams
    }
    return {
      policyParams: policyParamsObject ?? policyParams,
      policyParamsHex: result.policyParams,
      expireAfter: result.expireAfter,
    } as {
      policyParams: string
      policyParamsHex: `0x${string}`
      expireAfter: number
    }
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getPolicyConfig - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const supportsInterface = async ({
  publicClient,
  policyContractAddress,
  interfaceId,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
  interfaceId: `0x${string}`
}): Promise<boolean> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'supportsInterface',
      args: [interfaceId],
    })
    return result as boolean
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get supportsInterface - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const owner = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
}): Promise<Address> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'owner',
    })
    return result as Address
  } catch (error) {
    throw new Error(`Newton SDK: Failed to get owner - ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const factory = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
}): Promise<Address> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'factory',
    })
    return result as Address
  } catch (error) {
    throw new Error(`Newton SDK: Failed to get factory - ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const entrypoint = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'entrypoint',
    })
    return result as string
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get entrypoint - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const clientToPolicyId = async ({
  publicClient,
  policyContractAddress,
  client,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
  client: Address
}): Promise<`0x${string}`> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'clientToPolicyId',
      args: [client],
    })
    return result as `0x${string}`
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get clientToPolicyId - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const getEntrypoint = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'getEntrypoint',
    })
    return result as string
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getEntrypoint - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const getMetadataCid = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'getMetadataCid',
    })
    return result as string
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getMetadataCid - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const getPolicyCid = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'getPolicyCid',
    })
    return result as string
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getPolicyCid - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const getWasmCid = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'getWasmCid',
    })
    return result as string
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getWasmCid - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const getSecretsSchemaCid = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'getSecretsSchemaCid',
    })
    return result as string
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getSecretsSchemaCid - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const setSecretsSchemaCid = async ({
  walletClient,
  policyContractAddress,
  secretsSchemaCid,
}: {
  walletClient: WalletClient
  policyContractAddress: Address
  secretsSchemaCid: string
}): Promise<`0x${string}`> => {
  try {
    if (!walletClient.chain) {
      throw new Error('Newton SDK: account and chain must be set on Wallet client')
    }

    const account = walletClient.account ?? (await walletClient.getAddresses())[0]
    const hash = await walletClient.writeContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'setSecretsSchemaCid',
      args: [secretsSchemaCid],
      chain: walletClient.chain,
      account,
    })
    return hash
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to setSecretsSchemaCid - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const getSchemaCid = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'getSchemaCid',
    })
    return result as string
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getSchemaCid - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const isPolicyVerified = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
}): Promise<boolean> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'isPolicyVerified',
    })
    return result as boolean
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get isPolicyVerified - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const metadataCid = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'metadataCid',
    })
    return result as string
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get metadataCid - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const policyCid = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'policyCid',
    })
    return result as string
  } catch (error) {
    throw new Error(`Newton SDK: Failed to get policyCid - ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const schemaCid = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient
  policyContractAddress: Address
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'schemaCid',
    })
    return result as string
  } catch (error) {
    throw new Error(`Newton SDK: Failed to get schemaCid - ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Recomputes a client's policy set id. Mirrors `NewtonPolicyClient._setPolicies`.
 *
 * `revision` is the value the set will carry — the client's current `policyRevision()` plus
 * one when predicting a pending `setPolicies`. Order and repeats are significant.
 */
const precomputePolicyId = (args: {
  chainId: number | bigint
  client: Address
  revision: number | bigint
  policies: PolicySpec[]
}): PolicyId => {
  try {
    const encoded = encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint64' },
        {
          type: 'tuple[]',
          components: [
            { name: 'policy', type: 'address' },
            {
              name: 'config',
              type: 'tuple',
              components: [
                { name: 'policyParams', type: 'bytes' },
                { name: 'expireAfter', type: 'uint32' },
              ],
            },
          ],
        },
      ],
      [POLICY_SET_DOMAIN, BigInt(args.chainId), args.client, BigInt(args.revision), args.policies],
    )

    return keccak256(encoded) as PolicyId
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to precompute policy ID - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

type InitializeContractArgs = {
  factory: Address
  entrypoint: string
  policyCid: string
  schemaCid: string
  /** Empty for a pure-Rego policy. */
  wasmCid: string
  /** Empty unless `wasmCid` is set. */
  secretsSchemaCid: string
  metadataCid: string
  owner: Address
}

/**
 * Args for `initialize`. Callers must supply the policy code hash one of two ways:
 *
 * - `policyCodeHash`: pre-computed `keccak256` of the Rego policy bytes (e.g. read from
 *   `policy_cids.json` or another out-of-band source). Takes precedence when both are set.
 * - `policyBytes`: the raw Rego policy bytes — the SDK computes `keccak256` for you. Use
 *   this when fetching from IPFS via `policyCid`, reading a local file, or any other
 *   transport. Bringing the bytes lets the SDK stay browser/edge friendly without taking
 *   an opinion on an IPFS gateway.
 *
 * Mirrors the resolution strategy in `newton-cli` (`commands/policy.rs`).
 */
export type InitializePolicyArgs = InitializeContractArgs & ({ policyCodeHash: Hex } | { policyBytes: Uint8Array })

type InitializeArgs = InitializePolicyArgs & {
  walletClient: WalletClient
  policyContractAddress: Address
}

/**
 * Initialize a NewtonPolicy contract on-chain.
 *
 * The contract's `initialize` requires `keccak256` of the Rego policy bytes as
 * `_policyCodeHash` so the on-chain hash matches the policy referenced by `policyCid`.
 * See {@link InitializePolicyArgs} for how to provide it.
 */
const initialize = async ({ walletClient, policyContractAddress, ...args }: InitializeArgs): Promise<`0x${string}`> => {
  try {
    if (!walletClient.chain) {
      throw new Error('Newton SDK: account and chain must be set on Wallet client')
    }

    const policyCodeHash = 'policyCodeHash' in args ? args.policyCodeHash : keccak256(args.policyBytes)

    const account = walletClient.account ?? (await walletClient.getAddresses())[0]
    const hash = await walletClient.writeContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'initialize',
      args: [
        args.factory,
        {
          entrypoint: args.entrypoint,
          policyCid: args.policyCid,
          schemaCid: args.schemaCid,
          wasmCid: args.wasmCid,
          secretsSchemaCid: args.secretsSchemaCid,
          metadataCid: args.metadataCid,
        },
        args.owner,
        policyCodeHash,
      ],
      chain: walletClient.chain,
      account,
    })
    return hash
  } catch (error) {
    throw new Error(`Newton SDK: Failed to initialize - ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const renounceOwnership = async ({
  walletClient,
  policyContractAddress,
}: {
  walletClient: WalletClient
  policyContractAddress: Address
}): Promise<`0x${string}`> => {
  try {
    if (!walletClient.chain) {
      throw new Error('Newton SDK: account and chain must be set on Wallet client')
    }

    const account = walletClient.account ?? (await walletClient.getAddresses())[0]
    const hash = await walletClient.writeContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'renounceOwnership',
      chain: walletClient.chain,
      account,
    })
    return hash
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to renounce ownership - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const transferOwnership = async ({
  walletClient,
  policyContractAddress,
  ...args
}: {
  walletClient: WalletClient
  policyContractAddress: Address
  newOwner: Address
}): Promise<`0x${string}`> => {
  try {
    if (!walletClient.chain) {
      throw new Error('Newton SDK: account and chain must be set on Wallet client')
    }

    const account = walletClient.account ?? (await walletClient.getAddresses())[0]
    const hash = await walletClient.writeContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'transferOwnership',
      args: [args.newOwner],
      chain: walletClient.chain,
      account,
    })
    return hash
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to transfer ownership - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

// Policy-set bindings on NewtonPolicyClient.

const getPolicies = async ({
  publicClient,
  policyClientAddress,
}: {
  publicClient: PublicClient
  policyClientAddress: Address
}): Promise<PolicySpec[]> => {
  try {
    const result = await publicClient.readContract({
      address: policyClientAddress,
      abi: NewtonPolicyClientAbi,
      functionName: 'getPolicies',
    })
    return result as unknown as PolicySpec[]
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getPolicies - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const policyRevision = async ({
  publicClient,
  policyClientAddress,
}: {
  publicClient: PublicClient
  policyClientAddress: Address
}): Promise<bigint> => {
  try {
    const result = await publicClient.readContract({
      address: policyClientAddress,
      abi: NewtonPolicyClientAbi,
      functionName: 'policyRevision',
    })
    return result as bigint
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get policyRevision - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

/** Atomic read of id, revision and set. Prefer this over three separate reads. */
const getPolicySetSnapshot = async ({
  publicClient,
  policyClientAddress,
}: {
  publicClient: PublicClient
  policyClientAddress: Address
}): Promise<{ policyId: Hex; revision: bigint; policies: PolicySpec[] }> => {
  try {
    const [policyId, revision, policies] = (await publicClient.readContract({
      address: policyClientAddress,
      abi: NewtonPolicyClientAbi,
      functionName: 'getPolicySetSnapshot',
    })) as unknown as [Hex, bigint, PolicySpec[]]
    return { policyId, revision, policies }
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getPolicySetSnapshot - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

const setPolicies = async ({
  walletClient,
  publicClient,
  policyClientAddress,
  policies,
}: {
  walletClient: WalletClient
  publicClient: PublicClient
  policyClientAddress: Address
  policies: PolicySpec[]
}): Promise<{ txHash: Hex; policyId: PolicyId }> => {
  try {
    if (!walletClient.account) throw new Error('walletClient has no account')

    const { request } = await publicClient.simulateContract({
      address: policyClientAddress,
      abi: NewtonPolicyClientAbi,
      functionName: 'setPolicies',
      args: [policies] as never,
      account: walletClient.account,
    })
    const txHash = await walletClient.writeContract(request)
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    const { policyId } = await getPolicySetSnapshot({ publicClient, policyClientAddress })
    return { txHash, policyId }
  } catch (error) {
    throw new Error(`Newton SDK: Failed to setPolicies - ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/** Factory provenance. A policy's self-reported `factory()` is not authoritative. */
const isPolicy = async ({
  publicClient,
  policyFactoryAddress,
  policy,
}: {
  publicClient: PublicClient
  policyFactoryAddress: Address
  policy: Address
}): Promise<boolean> => {
  try {
    const result = await publicClient.readContract({
      address: policyFactoryAddress,
      abi: NewtonPolicyFactoryAbi,
      functionName: 'isPolicy',
      args: [policy],
    })
    return result as boolean
  } catch (error) {
    throw new Error(`Newton SDK: Failed to get isPolicy - ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export const policyWriteFunctions = {
  // On-chain write functions
  initialize,
  setPolicies,
  setSecretsSchemaCid,
  renounceOwnership,
  transferOwnership,
}

export const policyReadFunctions = {
  // On-chain read functions
  getPolicyId,
  getPolicyConfig,
  supportsInterface,
  owner,
  factory,
  entrypoint,
  clientToPolicyId,
  getEntrypoint,
  getMetadataCid,
  getPolicyCid,
  getWasmCid,
  getSecretsSchemaCid,
  getSchemaCid,
  isPolicy,
  isPolicyVerified,
  getPolicies,
  getPolicySetSnapshot,
  policyRevision,
  metadataCid,
  policyCid,
  schemaCid,
  // Off-chain functions
  precomputePolicyId,
}

export const policyFunctions = {
  // On-chain read functions
  ...policyReadFunctions,
  // On-chain write functions
  ...policyWriteFunctions,
}
