# Getting Started with Newton Privacy

This guide walks you through encrypting sensitive data and submitting a privacy-enabled task on Newton Protocol.

## Prerequisites

- Node.js >= 20
- A Newton API key (contact the Newton team)
- A deployed policy client contract on Sepolia (or your target chain)

## Installation

```bash
npm install @magicnewton/newton-protocol-sdk viem
```

The privacy module depends on `@hpke/core`, `@hpke/chacha20poly1305`, and `@noble/curves`, which are included as dependencies of the SDK.

## Setup

```typescript
import { createWalletClient, http, sepolia } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { newtonWalletClientActions } from '@magicnewton/newton-protocol-sdk'

// Your wallet signer (EVM account for transaction signing)
const account = privateKeyToAccount('0xYourPrivateKey')

// Create a Newton-extended wallet client
const newton = createWalletClient({
  chain: sepolia,
  transport: http('https://rpc.sepolia.org'),
  account,
}).extend(
  newtonWalletClientActions({ apiKey: 'your-newton-api-key' })
)
```

## Step 1: Generate Ed25519 Signing Keys

Privacy operations use Ed25519 keys (separate from your EVM wallet keys). Generate a key pair for the user and one for the application:

```typescript
const userKeys = newton.generateSigningKeyPair()
const appKeys = newton.generateSigningKeyPair()

// Store these securely -- you'll need them for authorization signatures
console.log('User public key:', userKeys.publicKey)   // 64 hex chars (32 bytes)
console.log('App public key:', appKeys.publicKey)
```

Ed25519 keys are used for two purposes:
1. Signing SecureEnvelopes (proving who encrypted the data)
2. Dual-signature authorization (proving consent for data usage)

## Step 2: Fetch the Gateway's Encryption Key

The gateway exposes its X25519 public key via RPC. You only need to fetch this once (it changes only on gateway restart or key rotation):

```typescript
const { public_key: gatewayKey } = await newton.getPrivacyPublicKey()
console.log('Gateway X25519 key:', gatewayKey)  // 64 hex chars (32 bytes)
```

## Step 3: Encrypt and Upload Data

Use `uploadEncryptedData` for the combined encrypt-and-upload flow:

```typescript
const uploadResult = await newton.uploadEncryptedData({
  senderAddress: account.address,
  policyClient: '0xYourPolicyClientAddress',
  chainId: 11155111,  // Sepolia
  plaintext: {
    full_name: 'Alice Smith',
    date_of_birth: '1990-01-15',
    country: 'US',
  },
  signingKey: userKeys.privateKey,
  // recipientPublicKey is auto-fetched if omitted
})

if (!uploadResult.success) {
  throw new Error(`Upload failed: ${uploadResult.error}`)
}

const dataRefId = uploadResult.data_ref_id
console.log('Data stored with ref:', dataRefId)
```

The data is now stored encrypted on the gateway. Only the gateway can decrypt it (using its HPKE private key), and it will only do so during policy evaluation when proper authorization signatures are provided.

## Step 4: Create Privacy Authorization Signatures

Before submitting a task that references encrypted data, you need dual Ed25519 signatures -- one from the user and one from the application:

```typescript
import { keccak256, encodePacked } from 'viem'

// Compute the intent hash (same intent you'll submit in the task)
const intent = {
  from: account.address,
  to: '0xRecipientAddress',
  value: '0x0',
  data: '0x',
  chainId: 11155111,
  functionSignature: '0x12345678',
}

// Hash the intent for authorization binding
const intentHash = keccak256(
  encodePacked(
    ['address', 'address', 'uint256', 'bytes', 'uint256', 'bytes4'],
    [intent.from, intent.to, BigInt(0), intent.data, BigInt(intent.chainId), intent.functionSignature]
  )
)

// Sign the authorization
const auth = newton.signPrivacyAuthorization({
  policyClient: '0xYourPolicyClientAddress',
  intentHash,
  encryptedDataRefs: [dataRefId],
  userSigningKey: userKeys.privateKey,
  appSigningKey: appKeys.privateKey,
})
```

## Step 5: Submit a Privacy-Enabled Task

Include the encrypted data references and authorization signatures in your task submission:

```typescript
const result = await newton.evaluateIntentDirect({
  policyClient: '0xYourPolicyClientAddress',
  intent: {
    from: account.address,
    to: '0xRecipientAddress',
    value: '0x0',
    data: '0x',
    chainId: 11155111,
    functionSignature: '0x12345678',
  },
  timeout: 30,
  encryptedDataRefs: [dataRefId],
  userSignature: auth.userSignature,
  appSignature: auth.appSignature,
})

console.log('Evaluation result:', result.result.evaluationResult)
```

The gateway will:
1. Validate the dual Ed25519 signatures
2. Decrypt the referenced data using HPKE
3. Merge the plaintext into the policy evaluation context
4. Broadcast to operators for Rego policy evaluation
5. Aggregate BLS signatures and return the result

## Next Steps

- Read [Concepts](concepts.md) to understand the cryptographic model
- See [API Reference](api-reference.md) for all available functions and types
- Check [Examples](examples.md) for complete integration patterns
