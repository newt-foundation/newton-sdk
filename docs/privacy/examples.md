# Privacy Integration Examples

## Example 1: Basic Encryption Flow

The simplest privacy integration -- encrypt a JSON object and use it in a task.

```typescript
import { createWalletClient, http, keccak256, encodePacked } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import {
  newtonWalletClientActions,
  generateSigningKeyPair,
  createSecureEnvelope,
  uploadEncryptedData,
  signPrivacyAuthorization,
  getPrivacyPublicKey,
} from '@magicnewton/newton-protocol-sdk'

// -- Setup --

const API_KEY = process.env.NEWTON_API_KEY!
const POLICY_CLIENT = '0xYourPolicyClientAddress' as const

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY!}`)
const newton = createWalletClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL ?? 'https://rpc.sepolia.org'),
  account,
}).extend(newtonWalletClientActions({ apiKey: API_KEY }))

// -- Privacy Flow --

async function submitPrivateTask() {
  // 1. One-time: generate Ed25519 key pairs
  //    In production, persist these in secure storage
  const userKeys = generateSigningKeyPair()
  const appKeys = generateSigningKeyPair()

  // 2. One-time: fetch gateway's encryption key (cacheable)
  const { public_key: gatewayPubKey } = await newton.getPrivacyPublicKey()

  // 3. Encrypt and upload sensitive data
  const sensitive = {
    full_name: 'Alice Smith',
    tax_id: '123-45-6789',
    jurisdiction: 'US',
  }

  const upload = await newton.uploadEncryptedData({
    senderAddress: account.address,
    policyClient: POLICY_CLIENT,
    chainId: sepolia.id,
    plaintext: sensitive,
    signingKey: userKeys.privateKey,
    recipientPublicKey: gatewayPubKey, // pass to avoid extra RPC call
  })

  if (!upload.success || !upload.data_ref_id) {
    throw new Error(`Upload failed: ${upload.error}`)
  }

  console.log('Encrypted data ref:', upload.data_ref_id)

  // 4. Build the intent
  const intent = {
    from: account.address,
    to: '0x0000000000000000000000000000000000000001' as const,
    value: '0x0' as const,
    data: '0x' as const,
    chainId: sepolia.id,
    functionSignature: '0x12345678' as const,
  }

  // 5. Compute intent hash for authorization binding
  const intentHash = keccak256(
    encodePacked(
      ['address', 'address', 'uint256', 'bytes', 'uint256', 'bytes4'],
      [
        intent.from,
        intent.to,
        BigInt(0),
        intent.data,
        BigInt(intent.chainId),
        intent.functionSignature,
      ]
    )
  )

  // 6. Create dual authorization signatures
  const auth = newton.signPrivacyAuthorization({
    policyClient: POLICY_CLIENT,
    intentHash,
    encryptedDataRefs: [upload.data_ref_id],
    userSigningKey: userKeys.privateKey,
    appSigningKey: appKeys.privateKey,
  })

  // 7. Submit task with privacy fields
  const result = await newton.evaluateIntentDirect({
    policyClient: POLICY_CLIENT,
    intent,
    timeout: 30,
    encryptedDataRefs: [upload.data_ref_id],
    userSignature: auth.userSignature,
    appSignature: auth.appSignature,
    userPublicKey: auth.userPublicKey,
    appPublicKey: auth.appPublicKey,
  })

  console.log('Policy evaluation result:', result.result.evaluationResult)
  return result
}

submitPrivateTask().catch(console.error)
```

## Example 2: KYC Compliance Flow

A more realistic example where a DApp collects KYC data, encrypts it, and submits a compliance check.

```typescript
import type { Address } from 'viem'
import {
  generateSigningKeyPair,
  uploadEncryptedData,
  signPrivacyAuthorization,
  getPrivacyPublicKey,
} from '@magicnewton/newton-protocol-sdk'

interface KycData {
  firstName: string
  lastName: string
  dateOfBirth: string
  nationality: string
  documentType: 'passport' | 'drivers_license' | 'national_id'
  documentNumber: string
}

/**
 * KYC privacy manager -- handles key management and encrypted data lifecycle.
 *
 * In production, persist `userKeys` and `appKeys` in secure storage
 * (e.g., browser IndexedDB with encryption, server-side HSM, or AWS Secrets Manager).
 */
class KycPrivacyManager {
  private gatewayPubKey: string | null = null

  constructor(
    private readonly chainId: number,
    private readonly apiKey: string,
    private readonly policyClient: Address,
    private readonly userKeys = generateSigningKeyPair(),
    private readonly appKeys = generateSigningKeyPair(),
  ) {}

  /** Fetch and cache the gateway's encryption key. */
  async ensureGatewayKey(): Promise<string> {
    if (!this.gatewayPubKey) {
      const res = await getPrivacyPublicKey(this.chainId, this.apiKey)
      this.gatewayPubKey = res.public_key
    }
    return this.gatewayPubKey
  }

  /**
   * Encrypt KYC data and upload to the gateway.
   * Returns the data reference ID for use in task creation.
   */
  async encryptAndUploadKyc(
    senderAddress: Address,
    kycData: KycData,
  ): Promise<string> {
    const gatewayKey = await this.ensureGatewayKey()

    const result = await uploadEncryptedData(
      this.chainId,
      this.apiKey,
      {
        senderAddress,
        policyClient: this.policyClient,
        chainId: this.chainId,
        plaintext: kycData,
        signingKey: this.userKeys.privateKey,
        recipientPublicKey: gatewayKey,
        ttl: 86400, // 24 hours
      },
    )

    if (!result.success || !result.data_ref_id) {
      throw new Error(`KYC upload failed: ${result.error}`)
    }

    return result.data_ref_id
  }

  /**
   * Create authorization signatures for a privacy-enabled task.
   */
  authorize(intentHash: string, dataRefIds: string[]) {
    return signPrivacyAuthorization({
      policyClient: this.policyClient,
      intentHash,
      encryptedDataRefs: dataRefIds,
      userSigningKey: this.userKeys.privateKey,
      appSigningKey: this.appKeys.privateKey,
    })
  }

  /** Invalidate cached gateway key (call after key rotation). */
  clearGatewayKeyCache() {
    this.gatewayPubKey = null
  }
}

// -- Usage --

const kycManager = new KycPrivacyManager(
  11155111,             // Sepolia
  'your-api-key',
  '0xPolicyClient' as Address,
)

// Collect KYC data from user (e.g., form submission)
const kycData: KycData = {
  firstName: 'Alice',
  lastName: 'Smith',
  dateOfBirth: '1990-01-15',
  nationality: 'US',
  documentType: 'passport',
  documentNumber: 'AB1234567',
}

// Encrypt and upload
const refId = await kycManager.encryptAndUploadKyc(
  '0xUserAddress' as Address,
  kycData,
)

// Later, when submitting the task:
const auth = kycManager.authorize(intentHash, [refId])
// Pass auth.userSignature, auth.appSignature, and [refId] to task creation
```

## Example 3: Offline Envelope Creation (Advanced)

For applications that need fine-grained control, use `createSecureEnvelope` directly. This is useful when:

- You want to encrypt without uploading (e.g., store locally first)
- You need to inspect the envelope before sending
- You're building a custom upload flow

```typescript
import { createSecureEnvelope, generateSigningKeyPair } from '@magicnewton/newton-protocol-sdk'

const keys = generateSigningKeyPair()

// Create an envelope without any network calls
const result = await createSecureEnvelope(
  {
    plaintext: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
    policyClient: '0x1234567890abcdef1234567890abcdef12345678',
    chainId: 1,
    recipientPublicKey: 'ab'.repeat(32), // 32-byte X25519 key
  },
  keys.privateKey,
)

console.log('Envelope fields:')
console.log('  enc (encapsulated key):', result.envelope.enc)
console.log('  ciphertext length:', result.envelope.ciphertext.length / 2, 'bytes')
console.log('  policy_client:', result.envelope.policy_client)
console.log('  chain_id:', result.envelope.chain_id)
console.log('Signature:', result.signature)
console.log('Sender public key:', result.senderPublicKey)

// Each call produces different ciphertext (ephemeral keys)
const result2 = await createSecureEnvelope(
  {
    plaintext: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
    policyClient: '0x1234567890abcdef1234567890abcdef12345678',
    chainId: 1,
    recipientPublicKey: 'ab'.repeat(32),
  },
  keys.privateKey,
)

console.log('Same input, different ciphertext:', result.envelope.enc !== result2.envelope.enc)
console.log('Same sender key:', result.senderPublicKey === result2.senderPublicKey)
```

## Example 4: Multiple Data References

A task can reference multiple encrypted data blobs. Each gets its own upload and ref ID:

```typescript
// Upload identity data
const identityRef = await newton.uploadEncryptedData({
  senderAddress: account.address,
  policyClient: POLICY_CLIENT,
  chainId: sepolia.id,
  plaintext: { name: 'Alice Smith', dob: '1990-01-15' },
  signingKey: userKeys.privateKey,
  recipientPublicKey: gatewayKey,
})

// Upload financial data (separate envelope, separate ref)
const financialRef = await newton.uploadEncryptedData({
  senderAddress: account.address,
  policyClient: POLICY_CLIENT,
  chainId: sepolia.id,
  plaintext: { income: 85000, currency: 'USD', source: 'employment' },
  signingKey: userKeys.privateKey,
  recipientPublicKey: gatewayKey,
})

// Authorize both refs in a single authorization
const auth = newton.signPrivacyAuthorization({
  policyClient: POLICY_CLIENT,
  intentHash,
  encryptedDataRefs: [identityRef.data_ref_id!, financialRef.data_ref_id!],
  userSigningKey: userKeys.privateKey,
  appSigningKey: appKeys.privateKey,
})

// Submit task referencing both
const result = await newton.evaluateIntentDirect({
  policyClient: POLICY_CLIENT,
  intent,
  timeout: 30,
  encryptedDataRefs: [identityRef.data_ref_id!, financialRef.data_ref_id!],
  userSignature: auth.userSignature,
  appSignature: auth.appSignature,
  userPublicKey: auth.userPublicKey,
  appPublicKey: auth.appPublicKey,
})
```

The Rego policy receives all decrypted data under `data.data.privacy` in the evaluation context, so it can cross-reference identity and financial information in a single evaluation pass.
