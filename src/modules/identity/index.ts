/**
 * Newton Identity Module
 *
 * On-chain: `linkIdentity*` / `unlinkIdentity*` — direct contract calls to IdentityRegistry
 *
 * TODO: Add `registerIdentityDataRef` writeContract wrapper when the IdentityRegistry contract
 * adds `registerIdentityDataRef(address owner, bytes32 domain, bytes32 dataRefId)` in
 * newton-prover-avs. This is part of the HPKE migration (AWS KMS → Newton Privacy Layer):
 *
 * Post-migration flow:
 *   1. newton-identity popup encrypts identity data with HPKE (via SDK privacy module)
 *   2. Popup uploads envelope: SDK `uploadEncryptedData()` → returns `data_ref_id`
 *   3. Popup stores ref on-chain: SDK `registerIdentityDataRef(owner, domain, dataRefId)`
 *   4. Gateway watches `IdentityDataRefRegistered` event → confirms off-chain storage
 *   5. At evaluation: operators fetch envelope by ref → HPKE decrypt
 *
 * This replaces the current `newt_sendIdentityEncrypted` RPC flow where full encrypted
 * blobs are stored on-chain. See `newton-identity/docs/HPKE_MIGRATION.md` for details.
 */

import { IdentityRegistryAbi } from '@core/abis/newtonIdentityRegistryAbi'
import { IDENTITY_REGISTRY } from '@core/const'
import { SDKError } from '@core/sdk-exceptions'
import { SDKErrorCode } from '@core/types/core/exception-types'
import type {
  LinkIdentityAsSignerAndUserParams,
  LinkIdentityAsSignerParams,
  LinkIdentityAsUserParams,
  LinkIdentityParams,
  UnlinkIdentityAsSignerParams,
  UnlinkIdentityAsUserParams,
} from '@core/types/identity'
import { type Account, type Chain, type Hex, type WalletClient, keccak256, toBytes } from 'viem'

/**
 * Compute the bytes32 identity domain hash from a human-readable domain name.
 *
 * Matches the Rust convention: `keccak256(toBytes("kyc"))` producing a bytes32 hash.
 */
export function identityDomainHash(domainName: string): Hex {
  return keccak256(toBytes(domainName))
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
