/**
 * Newton Identity Module — EIP-712 signed identity data submission to the on-chain IdentityRegistry.
 *
 * The gateway's `newt_sendIdentityEncrypted` RPC method accepts an EIP-712 signature over
 * `EncryptedIdentityData { string data }` with domain `{name: "IdentityRegistry", version: "1"}`.
 * The `identity_domain` field (bytes32 = keccak256 of the domain name) tells the gateway
 * how to interpret the blob after decryption.
 */

import { GATEWAY_METHODS } from '@core/const'
import { SDKError } from '@core/sdk-exceptions'
import { SDKErrorCode } from '@core/types/core/exception-types'
import type {
  SendIdentityEncryptedParams,
  SendIdentityEncryptedResponse,
  SendIdentityEncryptedRpcRequest,
} from '@core/types/identity'
import { AvsHttpService } from '@core/utils/https'
import { type Hex, type WalletClient, getAddress, isAddress, keccak256, toBytes } from 'viem'

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
  if (!isAddress(params.identityRegistryAddress)) {
    throw new SDKError(
      SDKErrorCode.InvalidAddress,
      `invalid identityRegistryAddress: ${params.identityRegistryAddress}`,
    )
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
      verifyingContract: params.identityRegistryAddress,
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
