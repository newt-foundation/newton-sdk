import type {
  NewtonAuthSigner,
  NewtonRequest,
  NewtonSession,
  SignNewtonRequestParams,
  SignedSessionGrant,
} from '@core/types/delegator'
import {
  type Address,
  type Hex,
  type LocalAccount,
  type WalletClient,
  hashTypedData,
  isAddressEqual,
  keccak256,
  stringToBytes,
  zeroHash,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

// The request-auth scheme newton-delegator and the gateway share (newton-prover-avs
// crates/chainio/src/gateway_auth): an EIP-712 NewtonRequest, sent as base64url JSON in X-Newton-Auth.

/** Header carrying the signed request. */
const NEWTON_AUTH_HEADER = 'X-Newton-Auth'

const AUTH_DOMAIN_NAME = 'Newton Gateway'
const AUTH_DOMAIN_VERSION = '1'

const NEWTON_REQUEST_TYPES = {
  NewtonRequest: [
    { name: 'audience', type: 'string' },
    { name: 'method', type: 'string' },
    { name: 'bodyHash', type: 'bytes32' },
    { name: 'signer', type: 'address' },
    { name: 'timestamp', type: 'uint64' },
    { name: 'sessionHash', type: 'bytes32' },
  ],
} as const

const SESSION_KEY_TYPES = {
  SessionKey: [
    { name: 'grantor', type: 'address' },
    { name: 'sessionKey', type: 'address' },
    { name: 'expiresAt', type: 'uint64' },
  ],
} as const

/** Chain 0 means the request names no chain, and the domain then omits it. Grants never carry one. */
const authDomain = (chainId?: number) =>
  chainId
    ? { name: AUTH_DOMAIN_NAME, version: AUTH_DOMAIN_VERSION, chainId }
    : { name: AUTH_DOMAIN_NAME, version: AUTH_DOMAIN_VERSION }

/** The `audience` to sign for a URL: its lowercased hostname, without scheme, port, path or IPv6 brackets. */
const audienceFromUrl = (url: string): string => {
  const host = new URL(url).hostname.toLowerCase()
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
}

const isLocalAccount = (signer: NewtonAuthSigner): signer is LocalAccount => 'type' in signer && signer.type === 'local'

const signerAddress = async (signer: NewtonAuthSigner): Promise<Address> => {
  if (isLocalAccount(signer)) return signer.address
  const walletClient = signer
  const account = walletClient.account ?? (await walletClient.getAddresses())[0]
  if (!account) throw new Error('Newton SDK: walletClient has no account to sign with')
  return typeof account === 'string' ? account : account.address
}

const signTyped = async (
  signer: NewtonAuthSigner,
  typedData: Parameters<LocalAccount['signTypedData']>[0],
): Promise<Hex> => {
  if (isLocalAccount(signer)) return signer.signTypedData(typedData)
  const walletClient = signer
  const account = walletClient.account ?? (await walletClient.getAddresses())[0]
  if (!account) throw new Error('Newton SDK: walletClient has no account to sign with')
  return walletClient.signTypedData({ account, ...typedData } as Parameters<WalletClient['signTypedData']>[0])
}

const base64UrlEncode = (text: string): string => {
  let binary = ''
  for (const byte of stringToBytes(text)) binary += String.fromCharCode(byte)
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_')
  let end = encoded.length
  while (end > 0 && encoded[end - 1] === '=') end--
  return encoded.slice(0, end)
}

/** The digest a grantor signs for a session grant; also the request's `sessionHash`. */
const sessionGrantTypedData = (grant: SignedSessionGrant['grant']) => ({
  domain: authDomain(),
  types: SESSION_KEY_TYPES,
  primaryType: 'SessionKey' as const,
  message: { grantor: grant.grantor, sessionKey: grant.sessionKey, expiresAt: BigInt(grant.expiresAt) },
})

/**
 * Sign a `NewtonRequest` and return the `X-Newton-Auth` header value. `body` must be the exact
 * bytes sent (`''` for a GET); re-serializing it afterwards breaks the signature.
 */
async function signNewtonRequest(signer: NewtonAuthSigner, params: SignNewtonRequestParams): Promise<string> {
  const session = params.session
  if (session && !isAddressEqual(await signerAddress(signer), session.grant.sessionKey)) {
    throw new Error('Newton SDK: a session request must be signed by the grant’s session key')
  }
  const request: NewtonRequest = {
    audience: params.audience,
    method: params.method,
    bodyHash: keccak256(stringToBytes(params.body)),
    signer: await signerAddress(signer),
    timestamp: params.timestamp ?? Date.now(),
    sessionHash: session ? keccakSessionHash(session.grant) : zeroHash,
  }
  const signature = await signTyped(signer, {
    domain: authDomain(params.chainId),
    types: NEWTON_REQUEST_TYPES,
    primaryType: 'NewtonRequest',
    message: { ...request, timestamp: BigInt(request.timestamp) },
  })
  return base64UrlEncode(JSON.stringify({ request, signature, ...(session ? { session } : {}) }))
}

const keccakSessionHash = (grant: SignedSessionGrant['grant']): Hex => hashTypedData(sessionGrantTypedData(grant))

/**
 * Sign, as the grantor, a grant letting `sessionKey` sign Newton requests on its behalf until
 * `expiresAt` (unix seconds). The delegator caps how far ahead `expiresAt` may be (7 days by default).
 */
async function signSessionGrant(
  grantor: NewtonAuthSigner,
  args: { sessionKey: Address; expiresAt: number },
): Promise<SignedSessionGrant> {
  const grant = { grantor: await signerAddress(grantor), sessionKey: args.sessionKey, expiresAt: args.expiresAt }
  const signature = await signTyped(grantor, sessionGrantTypedData(grant))
  return { grant, signature }
}

/**
 * Create an ephemeral session key and have `grantor` sign one grant for it, so later requests are
 * signed locally instead of prompting the grantor's wallet each time. Keep the result in memory;
 * its key can act as the grantor until the grant expires.
 */
async function createNewtonSession(grantor: NewtonAuthSigner, args: { expiresInSecs: number }): Promise<NewtonSession> {
  const account = privateKeyToAccount(generatePrivateKey())
  const grant = await signSessionGrant(grantor, {
    sessionKey: account.address,
    expiresAt: Math.floor(Date.now() / 1000) + args.expiresInSecs,
  })
  return { account, grant }
}

export { NEWTON_AUTH_HEADER, audienceFromUrl, createNewtonSession, signNewtonRequest, signSessionGrant }
