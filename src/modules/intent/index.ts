import type { IntentFromParams } from '@core/types/task'
import { normalizeIntent } from '@core/utils/intent'
import { type Address, type Hex, type TypedDataDomain, type WalletClient, isAddressEqual, publicActions } from 'viem'

/** The `Intent` struct a policy client hashes, as EIP-712 types. */
const INTENT_TYPES = {
  Intent: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
    { name: 'chainId', type: 'uint256' },
    { name: 'functionSignature', type: 'bytes' },
  ],
} as const

/** A policy client's EIP-712 domain: the four fields the gateway and operators hash it with. */
interface PolicyClientDomain {
  name: string
  version: string
  chainId: bigint
  verifyingContract: Address
}

/** EIP-712 typed data for `intent` under a policy client's `domain`. */
const intentTypedData = (intent: IntentFromParams, domain: PolicyClientDomain) => {
  const normalized = normalizeIntent(intent)
  return {
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract,
    } satisfies TypedDataDomain,
    types: INTENT_TYPES,
    primaryType: 'Intent' as const,
    message: {
      from: normalized.from,
      to: normalized.to,
      value: normalized.value,
      data: normalized.data,
      chainId: normalized.chainId,
      functionSignature: normalized.functionSignature,
    },
  }
}

const resolveAccount = async (walletClient: WalletClient) => {
  const account = walletClient.account ?? (await walletClient.getAddresses())[0]
  if (!account) {
    throw new Error('Newton SDK: walletClient has no account to sign with')
  }
  return account
}

/** Resolve the wallet's account and check it is `intent.from`. */
const resolveIntentSigner = async (walletClient: WalletClient, intent: IntentFromParams) => {
  const account = await resolveAccount(walletClient)
  const signer = typeof account === 'string' ? account : account.address
  if (!isAddressEqual(signer, intent.from)) {
    throw new Error(`Newton SDK: intent.from ${intent.from} does not match the signing account ${signer}`)
  }
  return account
}

/**
 * Read `policyClient`'s EIP-712 domain from its `eip712Domain()`, on the wallet client's chain.
 */
async function getPolicyClientDomain(walletClient: WalletClient, policyClient: Address): Promise<PolicyClientDomain> {
  const { domain } = await walletClient.extend(publicActions).getEip712Domain({ address: policyClient })
  return {
    name: domain.name,
    version: domain.version,
    chainId: BigInt(domain.chainId),
    verifyingContract: domain.verifyingContract,
  }
}

/**
 * Sign `intent` as `intent.from` for a gateway task (`intentSignature` on `submitEvaluationRequest`,
 * `evaluateIntentDirect` and friends). The domain is read from `policyClient`'s `eip712Domain()`,
 * which is what the gateway and operators recover the signer under, so it is right even when
 * `intent.to` is not the policy client. Works with local and JSON-RPC (browser wallet) accounts;
 * the wallet client must be on the policy client's chain.
 */
async function signIntent(
  walletClient: WalletClient,
  args: { policyClient: Address; intent: IntentFromParams },
): Promise<Hex> {
  const account = await resolveIntentSigner(walletClient, args.intent)
  const domain = await getPolicyClientDomain(walletClient, args.policyClient)
  return walletClient.signTypedData({ account, ...intentTypedData(args.intent, domain) })
}

export {
  INTENT_TYPES,
  getPolicyClientDomain,
  intentTypedData,
  resolveAccount,
  resolveIntentSigner,
  signIntent,
  type PolicyClientDomain,
}
