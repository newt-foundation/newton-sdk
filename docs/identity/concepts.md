# Identity Concepts

## Why a Popup for Identity?

Newton's identity system faces a fundamental trust problem: the identity owner's private key must sign sensitive operations (linking identity to apps, submitting encrypted KYC data), but the parent application requesting these operations is untrusted.

A compromised or malicious parent app could:
- **Capture the key** and link/unlink the identity without consent
- **Forge signing prompts** to trick users into signing unintended data
- **Exfiltrate credentials** to compromise the identity across all Newton-integrated apps

The popup solves this by running identity operations in a **separate browser window** with complete origin isolation. The parent app communicates via `postMessage` only — it receives signatures and results, never keys or credentials.

This is the same security model used by OAuth login popups and hardware wallet confirmation screens: the signing context is isolated from the requesting context.

## Identity Owner EOA (Master Key)

Each user has a single Ethereum address that serves as their **global identity authority** across all Newton-integrated applications. This address:

- Is created and custodied by Turnkey (hardware-backed secure enclave)
- Is accessed only via WebAuthn passkeys (biometric or security key)
- Signs all identity operations (link, unlink, register data)
- Cannot be extracted or exported — Turnkey's `signRawPayload()` returns signatures, never the private key

The "Master Key" terminology comes from the product specification. In protocol terms, it's the Identity Owner EOA — the `identityOwner` address in IdentityRegistry contract calls.

## Identity Domains

An identity domain is a namespaced category of identity data. Each domain:

- Is identified by `keccak256(domainName)` (a bytes32 hash)
- Contains domain-specific data fields (e.g., KYC has status, country, birthdate)
- Is linked independently — a user can link their KYC domain to App A without linking their accreditation domain

### Why Domain Separation?

Without domains, linking identity to an app would be all-or-nothing: the app would access all identity data or none. Domains enable granular consent:

```
User's Identity
├── kyc domain       → linked to App A, App B
├── accreditation    → linked to App A only
└── credit           → not linked to any app
```

### Domain Hash Computation

```typescript
import { keccak256, toBytes } from 'viem'

const kycDomain = keccak256(toBytes('kyc'))
// 0x33a1...  (deterministic, matches Rust and Solidity)
```

The SDK provides `identityDomainHash('kyc')` as a convenience wrapper.

## EIP-712 Signing

All identity operations use EIP-712 typed data signatures for:

1. **Human-readable signing** — wallets display structured data, not raw hashes
2. **Domain separation** — signatures are bound to a specific IdentityRegistry contract and chain
3. **Replay protection** — nonces and deadlines prevent signature reuse

<!-- TODO (HPKE migration): The EncryptedIdentityData EIP-712 struct is Phase 1 only.
     Post-migration, identity data is HPKE-encrypted and Ed25519-signed (no EIP-712 for data).
     This section should be updated to describe the envelope signing model instead. -->

### Why a Single Struct for All Domains?

The `EncryptedIdentityData { string data }` struct is intentionally minimal. Since the `data` field contains encrypted ciphertext, displaying per-field types in the wallet signing prompt would show meaningless hex — no benefit to the user.

The identity domain is passed as a separate RPC parameter, not inside the signed struct. The gateway uses the domain hash to route the decrypted data to the correct interpreter.

## Link/Unlink Mechanics

### What Is a Link?

A link is an on-chain record in the IdentityRegistry that associates:
- An **identity owner** (Master Key EOA)
- A **policy client** (smart contract using Newton for authorization)
- A **client user** (the app's user EOA)
- One or more **identity domains** (which data categories the app can access)

When a Rego policy evaluates a transaction from the client user through the policy client, it can query the linked identity data for the identity owner.

### Multi-Party Authorization

Links require consent from both the identity owner and the client user. The contract supports four authorization patterns:

| Function | Who Submits TX | Signatures Required |
|----------|---------------|-------------------|
| `linkIdentityAsSignerAndUser` | Caller (is both parties) | None (caller proves both roles) |
| `linkIdentityAsSigner` | Identity owner | Client user's EIP-712 signature |
| `linkIdentityAsUser` | Client user | Identity owner's EIP-712 signature |
| `linkIdentity` | Third party | Both EIP-712 signatures |

### Unlink: No Counterparty Consent

Either party can unilaterally revoke a link:
- `unlinkIdentityAsSigner` — identity owner revokes (they control their data)
- `unlinkIdentityAsUser` — client user revokes (they control their app association)

No signature from the other party is required. This is intentional — both parties should be able to exit the relationship independently.

### Replay Protection

EIP-712 link signatures include:
- **Nonce**: fetched from `IdentityRegistry.nonces(signer)`, incremented per successful link
- **Deadline**: `block.timestamp + 300` (5-minute window)

A used nonce cannot be reused. An expired deadline cannot be submitted. Together, they prevent signature replay and time-delayed attacks.

## Encryption Pipeline

<!-- TODO (HPKE migration): Replace the "Current" section with the HPKE flow once migrated.
     The "Future" section becomes the current state. Remove the stop-gap framing.
     Update step 4 in the Current section: EIP-712 signing is replaced by Ed25519.
     Update step 5: newt_sendIdentityEncrypted replaced by newt_uploadIdentityEncrypted + registerIdentityData.
     See docs/identity/hpke-migration.md for the full migration plan. -->

### Current: AWS KMS RSA-OAEP

The newton-identity popup encrypts identity data using AWS KMS:

1. Fetch the KMS public key (RSA-OAEP)
2. JSON-serialize the identity data (e.g., KYC fields)
3. Encrypt with `crypto.subtle.encrypt('RSA-OAEP', kmsPublicKey, plaintext)`
4. Convert ciphertext to hex string
5. Sign hex string with EIP-712 (`EncryptedIdentityData { string data }`)
6. Submit signature + encrypted data to gateway via `newt_sendIdentityEncrypted`

This is a **stop-gap** — it relies on a centralized AWS KMS key for encryption, which is a single point of trust.

### Future: Newton Privacy Layer

The encryption will migrate to the Newton Privacy Layer (HPKE, RFC 9180):

1. Fetch the gateway's X25519 public key via `newt_getPrivacyPublicKey`
2. Encrypt with HPKE (X25519 KEM + HKDF-SHA256 + ChaCha20-Poly1305)
3. AAD binding to `keccak256(policyClient, chainId)` prevents cross-context replay
4. Ed25519 envelope signing (replaces EIP-712 for identity data)
5. Call `newt_uploadIdentityEncrypted` → returns `{ data_ref_id, gateway_signature, deadline }`
6. Store ref on-chain via `registerIdentityData(domain, dataRefId, gatewaySig, deadline)`

This aligns identity encryption with the SDK's existing privacy module, enabling code reuse (`createSecureEnvelope`, `generateSigningKeyPair`).

## Rego Policy Integration

Linked identity data is accessible in Rego policies via domain-namespaced built-ins:

```rego
package newton.policy

import rego.v1

# Check if the user has approved KYC
default allow := false

allow if {
    newton.identity.kyc.check_approved()
    country := newton.identity.kyc.get("country")
    country != "OFAC_SANCTIONED"
}
```

Built-in functions:

| Function | Domain | Returns |
|----------|--------|---------|
| `newton.identity.kyc.check_approved()` | KYC | `true` if KYC status is approved |
| `newton.identity.kyc.get(field)` | KYC | Field value (country, birthdate, etc.) |
| `newton.identity.kyc.check_not_expired()` | KYC | `true` if KYC data has not expired |
| `newton.identity.get(field)` | Any | Cross-domain field lookup |

These built-ins are available only when the transaction's client user has an active identity link for the relevant domain on the policy client being evaluated.
