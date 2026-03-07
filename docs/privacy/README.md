# Newton Privacy Layer - Developer Guide

Client-side encryption for privacy-preserving policy evaluation on Newton Protocol.

The Newton SDK privacy module lets applications encrypt sensitive data (PII, credentials, financial details) so that it can be used in policy evaluation without exposing plaintext to third parties. Data is encrypted client-side using HPKE (RFC 9180), uploaded to the Newton gateway, and decrypted only inside the secure evaluation boundary.

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](getting-started.md) | Install, configure, and encrypt your first data |
| [Concepts](concepts.md) | HPKE encryption, Ed25519 signatures, dual authorization, AAD binding |
| [API Reference](api-reference.md) | Full TypeScript API with parameters, return types, and usage notes |
| [Examples](examples.md) | End-to-end integration patterns (basic flow, KYC compliance) |

## Quick Example

```typescript
import { createWalletClient, http, sepolia } from 'viem'
import { newtonWalletClientActions } from '@magicnewton/newton-protocol-sdk'

const client = createWalletClient({
  chain: sepolia,
  transport: http('https://rpc.sepolia.org'),
  account: signer,
}).extend(newtonWalletClientActions({ apiKey: 'your-api-key' }))

// 1. Get the gateway's encryption key
const { public_key } = await client.getPrivacyPublicKey()

// 2. Generate signing keys
const keyPair = client.generateSigningKeyPair()

// 3. Encrypt and upload sensitive data
const { data_ref_id } = await client.uploadEncryptedData({
  senderAddress: '0xYourAddress',
  policyClient: '0xPolicyClientAddress',
  chainId: 11155111,
  plaintext: { ssn: '123-45-6789', dob: '1990-01-01' },
  signingKey: keyPair.privateKey,
})

// 4. Submit a privacy-enabled task
const result = await client.evaluateIntentDirect({
  policyClient: '0xPolicyClientAddress',
  intent: { /* ... */ },
  timeout: 30,
  encryptedDataRefs: [data_ref_id],
  userSignature: '...', // from signPrivacyAuthorization
  appSignature: '...',
})
```

## Architecture Overview

```
Client (Browser/Server)          Newton Gateway              Operators
       |                              |                         |
       |-- 1. getPrivacyPublicKey --> |                         |
       |<-- X25519 public key -----  |                         |
       |                              |                         |
       |-- 2. HPKE encrypt (local) -- |                         |
       |-- 3. uploadEncryptedData --> |-- store encrypted -->   |
       |<-- data_ref_id -----------  |                         |
       |                              |                         |
       |-- 4. createTask ----------> |-- decrypt (HPKE) -->    |
       |   (with data refs + sigs)   |-- broadcast plaintext ->|
       |                              |                         |-- evaluate policy
       |                              |                         |-- BLS sign result
       |                              |<-- aggregated result ---|
       |<-- task result ------------ |                         |
```

Key properties:
- Encryption happens client-side (zero plaintext leaves the client)
- The gateway decrypts only at task evaluation time
- Operators receive plaintext only during the evaluation window, then zero it
- AAD binding prevents ciphertext reuse across different policy clients or chains
