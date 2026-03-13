# Privacy API Reference

All privacy functions are available both as standalone imports and as methods on the Newton wallet client.

## Standalone Imports

```typescript
import {
  createSecureEnvelope,
  getPrivacyPublicKey,
  uploadEncryptedData,
  generateSigningKeyPair,
  storeEncryptedSecrets,
  signPrivacyAuthorization,
} from '@magicnewton/newton-protocol-sdk'
```

## Wallet Client Methods

When using `newtonWalletClientActions`, the same functions are available as methods on the extended client. The client automatically provides `chainId` and `apiKey` from its configuration.

```typescript
const newton = createWalletClient({ ... }).extend(
  newtonWalletClientActions({ apiKey: 'your-key' })
)

newton.getPrivacyPublicKey()
newton.createSecureEnvelope(params, signingKey)
newton.uploadEncryptedData(params)
newton.generateSigningKeyPair()
newton.storeEncryptedSecrets(params)
newton.signPrivacyAuthorization(params)
```

---

## createSecureEnvelope

Encrypts plaintext into an HPKE SecureEnvelope with Ed25519 signature. This is a **pure offline function** -- zero network calls.

```typescript
async function createSecureEnvelope(
  params: CreateSecureEnvelopeParams,
  signingKey: string
): Promise<SecureEnvelopeResult>
```

### Parameters

**CreateSecureEnvelopeParams:**

| Field | Type | Description |
|-------|------|-------------|
| `plaintext` | `Uint8Array \| string \| Record<string, unknown>` | Data to encrypt. Objects are JSON-stringified. |
| `policyClient` | `Address` | Policy client address (used in AAD computation) |
| `chainId` | `number` | Chain ID (used in AAD computation) |
| `recipientPublicKey` | `string` | Gateway's X25519 public key (hex, 32 bytes, no `0x` prefix) |

**signingKey:** Ed25519 private key seed (hex, 32 bytes, no `0x` prefix)

### Returns

**SecureEnvelopeResult:**

| Field | Type | Description |
|-------|------|-------------|
| `envelope` | `SecureEnvelope` | The encrypted envelope (see below) |
| `signature` | `string` | Ed25519 signature over `JSON.stringify(envelope)` (hex, 64 bytes) |
| `senderPublicKey` | `string` | Sender's Ed25519 public key (hex, 32 bytes) |

**SecureEnvelope:**

| Field | Type | Description |
|-------|------|-------------|
| `enc` | `string` | HPKE encapsulated key (hex, 32 bytes) |
| `ciphertext` | `string` | Encrypted data + Poly1305 auth tag (hex) |
| `policy_client` | `string` | Policy client address |
| `chain_id` | `number` | Chain ID |
| `recipient_pubkey` | `string` | Recipient's X25519 public key (hex) |

### Example

```typescript
const result = await createSecureEnvelope(
  {
    plaintext: { ssn: '123-45-6789' },
    policyClient: '0x1234567890abcdef1234567890abcdef12345678',
    chainId: 11155111,
    recipientPublicKey: gatewayKey,
  },
  userKeys.privateKey
)
// result.envelope.ciphertext -- hex-encoded ciphertext
// result.signature -- hex-encoded Ed25519 signature
```

### Notes

- Each call produces different ciphertext (ephemeral HPKE keys are random)
- The signing key bytes are zeroed from memory after use
- Throws if `recipientPublicKey` is not valid hex

---

## getPrivacyPublicKey

Fetches the gateway's X25519 HPKE public key. Clients call this once to discover which key to encrypt SecureEnvelopes to.

```typescript
async function getPrivacyPublicKey(
  chainId: number,
  apiKey: string,
  gatewayApiUrlOverride?: string
): Promise<PrivacyPublicKeyResponse>
```

### Returns

**PrivacyPublicKeyResponse:**

| Field | Type | Description |
|-------|------|-------------|
| `public_key` | `string` | X25519 public key (hex, 32 bytes, no `0x` prefix) |
| `key_type` | `string` | Always `"x25519"` |
| `encryption_suite` | `string` | Cipher suite identifier |

### Notes

- The result is cacheable -- the key changes only on gateway restart or key rotation
- Makes one RPC call to `newt_getPrivacyPublicKey`

---

## uploadEncryptedData

Encrypts data and uploads to the gateway in a single call. Combines `createSecureEnvelope` + RPC upload.

```typescript
async function uploadEncryptedData(
  chainId: number,
  apiKey: string,
  params: UploadEncryptedDataParams,
  gatewayApiUrlOverride?: string
): Promise<UploadEncryptedDataResponse>
```

### Parameters

**UploadEncryptedDataParams:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `senderAddress` | `Address` | Yes | EVM address of the end user |
| `policyClient` | `Address` | Yes | Policy client address |
| `chainId` | `number` | Yes | Chain ID the policy client lives on |
| `plaintext` | `Uint8Array \| string \| Record<string, unknown>` | Yes | Data to encrypt and upload |
| `signingKey` | `string` | Yes | Ed25519 private key (hex, 32 bytes) |
| `recipientPublicKey` | `string` | No | Gateway's X25519 key. Auto-fetched if omitted. |
| `ttl` | `number` | No | TTL in seconds. Data expires after this duration. |

### Returns

**UploadEncryptedDataResponse:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Whether the upload succeeded |
| `data_ref_id` | `string \| null` | UUID of the stored reference (on success) |
| `error` | `string \| null` | Error message (on failure) |

### Example

```typescript
const { data_ref_id } = await uploadEncryptedData(
  11155111,
  'your-api-key',
  {
    senderAddress: '0xYourAddress',
    policyClient: '0xPolicyClient',
    chainId: 11155111,
    plaintext: { name: 'Alice', country: 'US' },
    signingKey: userKeys.privateKey,
    ttl: 3600, // expires in 1 hour
  }
)
```

### Notes

- If `recipientPublicKey` is omitted, makes an extra RPC call to `getPrivacyPublicKey`
- Pass `recipientPublicKey` when making multiple uploads to avoid redundant key fetches

---

## generateSigningKeyPair

Generates a random Ed25519 key pair. Pure offline function.

```typescript
function generateSigningKeyPair(): Ed25519KeyPair
```

### Returns

**Ed25519KeyPair:**

| Field | Type | Description |
|-------|------|-------------|
| `privateKey` | `string` | Ed25519 private key seed (hex, 32 bytes, no `0x` prefix) |
| `publicKey` | `string` | Ed25519 public key (hex, 32 bytes, no `0x` prefix) |

### Example

```typescript
const keyPair = generateSigningKeyPair()
// keyPair.privateKey: "a1b2c3..." (64 hex chars)
// keyPair.publicKey:  "d4e5f6..." (64 hex chars)
```

### Notes

- Uses `crypto.getRandomValues` for entropy
- Private key bytes are zeroed from memory after public key derivation
- Each call produces a different key pair

---

## storeEncryptedSecrets

Uploads KMS-encrypted secrets for a policy client's PolicyData. The gateway decrypts via AWS KMS, validates against the PolicyData schema, and stores for use during policy evaluation.

```typescript
async function storeEncryptedSecrets(
  chainId: number,
  apiKey: string,
  params: StoreEncryptedSecretsParams,
  gatewayApiUrlOverride?: string
): Promise<StoreEncryptedSecretsResponse>
```

### Parameters

**StoreEncryptedSecretsParams:**

| Field | Type | Description |
|-------|------|-------------|
| `policyClient` | `Address` | Policy client address |
| `policyDataAddress` | `Address` | PolicyData contract address |
| `secrets` | `string` | Base64-encoded KMS ciphertext of a JSON object |
| `chainId` | `number` | Chain ID the policy client lives on |

### Returns

**StoreEncryptedSecretsResponse:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Whether the upload succeeded |
| `schema` | `Record<string, unknown> \| null` | PolicyData schema used for validation |
| `error` | `string \| null` | Error message (on failure) |

### Notes

- The `secrets` field must be encrypted with the gateway's AWS KMS RSA key
- The gateway validates the decrypted JSON against the PolicyData's secrets schema
- Only the policy client owner (determined by `INewtonPolicyClient.getOwner()`) is authorized

---

## signPrivacyAuthorization

Computes dual Ed25519 signatures for privacy-enabled task creation. Pure offline function.

```typescript
function signPrivacyAuthorization(
  params: SignPrivacyAuthorizationParams
): PrivacyAuthorizationResult
```

### Parameters

**SignPrivacyAuthorizationParams:**

| Field | Type | Description |
|-------|------|-------------|
| `policyClient` | `Address` | Policy client address |
| `intentHash` | `string` | Keccak256 hash of the intent (hex, 32 bytes) |
| `encryptedDataRefs` | `string[]` | Data reference UUIDs from `uploadEncryptedData` |
| `userSigningKey` | `string` | User's Ed25519 private key (hex, 32 bytes) |
| `appSigningKey` | `string` | Application's Ed25519 private key (hex, 32 bytes) |

### Returns

**PrivacyAuthorizationResult:**

| Field | Type | Description |
|-------|------|-------------|
| `userSignature` | `string` | User Ed25519 signature (hex, 64 bytes) |
| `appSignature` | `string` | Application Ed25519 signature (hex, 64 bytes) |
| `userPublicKey` | `string` | User's Ed25519 public key (hex, 32 bytes) |
| `appPublicKey` | `string` | Application's Ed25519 public key (hex, 32 bytes) |

### Example

```typescript
const auth = signPrivacyAuthorization({
  policyClient: '0xPolicyClient',
  intentHash: keccak256(encodePacked(['address', 'uint256'], [to, value])),
  encryptedDataRefs: [refId1, refId2],
  userSigningKey: userKeys.privateKey,
  appSigningKey: appKeys.privateKey,
})
// Pass auth.userSignature and auth.appSignature to task creation
```

### Notes

- Both signing key bytes are zeroed from memory after use
- The app signature chains over the user signature (changing user sig changes app sig)
- Different `encryptedDataRefs` produce different signatures (refs are part of the user message)

---

## Privacy Fields on Task Creation

All three task creation methods accept optional privacy fields:

```typescript
interface SubmitEvaluationRequestParams {
  // ... standard fields ...

  /** Encrypted data reference UUIDs for privacy-preserving evaluation */
  encryptedDataRefs?: string[]
  /** User Ed25519 signature for privacy authorization (hex-encoded) */
  userSignature?: string
  /** Application Ed25519 signature for privacy authorization (hex-encoded) */
  appSignature?: string
  /** User Ed25519 public key for signature verification (hex-encoded, 32 bytes) */
  userPublicKey?: string
  /** Application Ed25519 public key for signature verification (hex-encoded, 32 bytes) */
  appPublicKey?: string
}
```

These fields are forwarded in:
- `submitEvaluationRequest` -- on-chain task creation
- `evaluateIntentDirect` -- synchronous gateway evaluation
- `submitIntentAndSubscribe` -- WebSocket subscription-based evaluation

When `encryptedDataRefs` is provided, `userSignature` and `appSignature` are required. Pass the `userPublicKey` and `appPublicKey` returned by `signPrivacyAuthorization()` so the gateway can verify the signatures.
