/**
 * Newton Identity Module
 *
 * Two categories of operations:
 * 1. Gateway RPC: `sendIdentityEncrypted` — EIP-712 signed identity data submission via gateway
 * 2. On-chain: `linkIdentity*` / `unlinkIdentity*` — direct contract calls to IdentityRegistry
 */

import { IdentityRegistryAbi } from '@core/abis/newtonIdentityRegistryAbi'
import { GATEWAY_METHODS, IDENTITY_REGISTRY } from '@core/const'
import { SDKError } from '@core/sdk-exceptions'
import { SDKErrorCode } from '@core/types/core/exception-types'
import type {
  LinkIdentityAsSignerAndUserParams,
  LinkIdentityAsSignerParams,
  LinkIdentityAsUserParams,
  LinkIdentityParams,
  SendIdentityEncryptedParams,
  SendIdentityEncryptedResponse,
  SendIdentityEncryptedRpcRequest,
  UnlinkIdentityAsSignerParams,
  UnlinkIdentityAsUserParams,
} from '@core/types/identity'
import { AvsHttpService } from '@core/utils/https'
import { type Account, type Chain, type Hex, type WalletClient, getAddress, isAddress, keccak256, toBytes } from 'viem'

/**
 * Compute the bytes32 identity domain hash from a human-readable domain name.
 *
 * Matches the Rust convention: `keccak256(toBytes("kyc"))` producing a bytes32 hash.
 */
export function identityDomainHash(domainName: string): Hex {
  return keccak256(toBytes(domainName))
}

/**
 * Sign encrypted identity data with EIP-712 and submit to the gateway.
 *
 * The wallet client signs `EncryptedIdentityData { string data }` using the
 * EIP-712 domain `{name: "IdentityRegistry", version: "1", chainId, verifyingContract}`.
 * The gateway validates the signature, then submits the data to the on-chain IdentityRegistry.
 *
 * @param walletClient - viem WalletClient with a connected account
 * @param params - Identity data and domain parameters
 * @param apiKey - Newton API key for gateway authentication
 * @param gatewayApiUrlOverride - Optional gateway URL override
 * @returns Transaction hash of the on-chain inclusion
 */
export async function sendIdentityEncrypted(
  walletClient: WalletClient,
  params: SendIdentityEncryptedParams,
  apiKey: string,
  gatewayApiUrlOverride?: string,
): Promise<SendIdentityEncryptedResponse> {
  const chainId = walletClient.chain?.id
  if (!chainId) throw new SDKError(SDKErrorCode.MissingChain, 'walletClient must have a chain configured')

  const account = walletClient.account
  if (!account) throw new SDKError(SDKErrorCode.MissingAccount, 'walletClient must have an account configured')

  if (!isAddress(params.identityOwner)) {
    throw new SDKError(SDKErrorCode.InvalidAddress, `invalid identityOwner address: ${params.identityOwner}`)
  }
  const identityRegistryAddress = IDENTITY_REGISTRY[chainId]
  if (!identityRegistryAddress) {
    throw new SDKError(SDKErrorCode.InvalidAddress, `no IdentityRegistry address for chain ${chainId}`)
  }

  // The signer must match the declared identity owner
  if (getAddress(account.address) !== getAddress(params.identityOwner)) {
    throw new SDKError(
      SDKErrorCode.IdentityOwnerMismatch,
      `wallet account ${account.address} does not match identityOwner ${params.identityOwner}`,
    )
  }

  // EIP-712 signature over EncryptedIdentityData { string data }
  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: 'IdentityRegistry',
      version: '1',
      chainId: BigInt(chainId),
      verifyingContract: identityRegistryAddress,
    },
    types: {
      EncryptedIdentityData: [{ name: 'data', type: 'string' }],
    },
    primaryType: 'EncryptedIdentityData',
    message: {
      data: params.identityData,
    },
  })

  const domainHash = identityDomainHash(params.identityDomain)

  const rpcRequest: SendIdentityEncryptedRpcRequest = {
    identity_owner: params.identityOwner,
    identity_owner_sig: signature,
    identity_data: { data: params.identityData },
    identity_domain: domainHash,
  }

  const avsHttpService = new AvsHttpService(chainId, gatewayApiUrlOverride)
  const res = await avsHttpService.Post(GATEWAY_METHODS.sendIdentityEncrypted, rpcRequest, apiKey)
  if (res.error) throw res.error
  return res.result as SendIdentityEncryptedResponse
}

// ---------------------------------------------------------------------------
// On-chain link/unlink operations (direct contract calls)
// ---------------------------------------------------------------------------

function resolveIdentityRegistry(walletClient: WalletClient): {
  registryAddress: Hex
  account: Account
  chain: Chain
} {
  const chain = walletClient.chain
  if (!chain) throw new SDKError(SDKErrorCode.MissingChain, 'walletClient must have a chain configured')

  const account = walletClient.account
  if (!account) throw new SDKError(SDKErrorCode.MissingAccount, 'walletClient must have an account configured')

  const registryAddress = IDENTITY_REGISTRY[chain.id]
  if (!registryAddress)
    throw new SDKError(SDKErrorCode.InvalidAddress, `no IdentityRegistry address for chain ${chain.id}`)

  return { registryAddress, account, chain }
}

/**
 * Link identity data when the caller is both identity owner and client user.
 * msg.sender must have submitted identity data for the given domains.
 */
export async function linkIdentityAsSignerAndUser(
  walletClient: WalletClient,
  params: LinkIdentityAsSignerAndUserParams,
): Promise<Hex> {
  const { registryAddress, account, chain } = resolveIdentityRegistry(walletClient)

  return walletClient.writeContract({
    address: registryAddress,
    abi: IdentityRegistryAbi,
    functionName: 'linkIdentityAsSignerAndUser',
    args: [params.policyClient, params.identityDomains],
    account,
    chain,
  })
}

/**
 * Link identity data as the identity owner (signer).
 * Requires a counterparty signature from the client user.
 */
export async function linkIdentityAsSigner(
  walletClient: WalletClient,
  params: LinkIdentityAsSignerParams,
): Promise<Hex> {
  const { registryAddress, account, chain } = resolveIdentityRegistry(walletClient)

  return walletClient.writeContract({
    address: registryAddress,
    abi: IdentityRegistryAbi,
    functionName: 'linkIdentityAsSigner',
    args: [
      params.policyClient,
      params.identityDomains,
      params.clientUser,
      params.clientUserSignature,
      params.clientUserNonce,
      params.clientUserDeadline,
    ],
    account,
    chain,
  })
}

/**
 * Link identity data as the client user.
 * Requires a counterparty signature from the identity owner.
 */
export async function linkIdentityAsUser(walletClient: WalletClient, params: LinkIdentityAsUserParams): Promise<Hex> {
  const { registryAddress, account, chain } = resolveIdentityRegistry(walletClient)

  return walletClient.writeContract({
    address: registryAddress,
    abi: IdentityRegistryAbi,
    functionName: 'linkIdentityAsUser',
    args: [
      params.identityOwner,
      params.policyClient,
      params.identityDomains,
      params.identityOwnerSignature,
      params.identityOwnerNonce,
      params.identityOwnerDeadline,
    ],
    account,
    chain,
  })
}

/**
 * Link identity data as a 3rd party with signatures from both identity owner and client user.
 */
export async function linkIdentity(walletClient: WalletClient, params: LinkIdentityParams): Promise<Hex> {
  const { registryAddress, account, chain } = resolveIdentityRegistry(walletClient)

  return walletClient.writeContract({
    address: registryAddress,
    abi: IdentityRegistryAbi,
    functionName: 'linkIdentity',
    args: [
      params.identityOwner,
      params.clientUser,
      params.policyClient,
      params.identityDomains,
      params.identityOwnerSignature,
      params.identityOwnerNonce,
      params.identityOwnerDeadline,
      params.clientUserSignature,
      params.clientUserNonce,
      params.clientUserDeadline,
    ],
    account,
    chain,
  })
}

/**
 * Unlink identity data as the identity owner (signer).
 * Only the identity owner who created the link can call this.
 */
export async function unlinkIdentityAsSigner(
  walletClient: WalletClient,
  params: UnlinkIdentityAsSignerParams,
): Promise<Hex> {
  const { registryAddress, account, chain } = resolveIdentityRegistry(walletClient)

  return walletClient.writeContract({
    address: registryAddress,
    abi: IdentityRegistryAbi,
    functionName: 'unlinkIdentityAsSigner',
    args: [params.clientUser, params.policyClient, params.identityDomains],
    account,
    chain,
  })
}

/**
 * Unlink identity data as the client user.
 * Allows users to revoke links to their own account.
 */
export async function unlinkIdentityAsUser(
  walletClient: WalletClient,
  params: UnlinkIdentityAsUserParams,
): Promise<Hex> {
  const { registryAddress, account, chain } = resolveIdentityRegistry(walletClient)

  return walletClient.writeContract({
    address: registryAddress,
    abi: IdentityRegistryAbi,
    functionName: 'unlinkIdentityAsUser',
    args: [params.policyClient, params.identityDomains],
    account,
    chain,
  })
}
