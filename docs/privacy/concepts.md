# Privacy Layer Concepts

## Why Client-Side Encryption?

Newton Protocol evaluates user intents against Rego policies to authorize blockchain transactions. Some policies require access to sensitive data (KYC information, financial records, credentials) that users do not want to expose in plaintext over the network.

The privacy layer solves this with a simple principle: **encrypt on the client, decrypt only at evaluation time**.

- The client encrypts data locally using the gateway's public key
- The ciphertext travels over the network and is stored encrypted
- The gateway decrypts only when a properly authorized task references the data
- Operators see plaintext only during the evaluation window, then zero it

## HPKE Encryption (RFC 9180)

The SDK uses Hybrid Public Key Encryption with this cipher suite:

| Component | Algorithm | Purpose |
|-----------|-----------|---------|
| KEM | X25519 | Key encapsulation (Diffie-Hellman key agreement) |
| KDF | HKDF-SHA256 | Key derivation from shared secret |
| AEAD | ChaCha20-Poly1305 | Authenticated encryption with associated data |

This is the same suite used by the Rust gateway (`crates/core/src/crypto/hpke.rs`), ensuring interoperability.

### How It Works

1. The client fetches the gateway's X25519 public key (once, cacheable)
2. For each encryption, an ephemeral X25519 key pair is generated
3. The ephemeral private key + gateway public key produce a shared secret
4. The shared secret derives an encryption key via HKDF
5. ChaCha20-Poly1305 encrypts the plaintext with the derived key
6. The ephemeral private key is zeroed immediately after use

Each call to `createSecureEnvelope` produces different ciphertext, even for identical inputs, because the ephemeral key is random.

### AAD Context Binding

Every SecureEnvelope binds the ciphertext to a specific policy context via Additional Authenticated Data (AAD):

```
AAD = keccak256(abi.encodePacked(policy_client_address, chain_id))
```

This means:
- Ciphertext encrypted for policy client A cannot be decrypted under policy client B
- Ciphertext encrypted for chain 1 cannot be decrypted on chain 11155111
- Tampering with the `policy_client` or `chain_id` fields causes decryption to fail

AAD is not encrypted -- it's authenticated. The gateway verifies that the AAD in the envelope matches the task's policy client and chain before attempting decryption.

## Ed25519 Signatures

The privacy module uses Ed25519 (not ECDSA/secp256k1) for two reasons:

1. **Separation of concerns**: Privacy signing keys are independent from EVM wallet keys
2. **Deterministic signatures**: Ed25519 produces the same signature for the same message+key, making testing and debugging easier

### Key Pair Generation

`generateSigningKeyPair()` creates a random Ed25519 key pair:
- Private key: 32 bytes of cryptographic randomness (hex-encoded)
- Public key: derived from the private key via Ed25519 scalar multiplication

The private key bytes are zeroed from memory after the public key is derived.

### Envelope Signing

When creating a SecureEnvelope, the serialized envelope JSON is signed with the sender's Ed25519 key:

```
signature = Ed25519.sign(JSON.stringify(envelope), signing_key)
```

This proves who encrypted the data without revealing the plaintext.

## Dual-Signature Authorization

Privacy-enabled tasks require two Ed25519 signatures: one from the **user** and one from the **application**. This dual-signature model ensures that:

- The user consents to their encrypted data being used for this specific task
- The application authorizes the usage in its policy context
- Neither party can unilaterally use encrypted data references

### Signature Construction

**User signature:**
```
user_message = encodePacked(policy_client, intent_hash, ref_id_1, ref_id_2, ...)
user_digest  = keccak256(user_message)
user_sig     = Ed25519.sign(user_digest, user_private_key)
```

**Application signature (chains over user signature):**
```
app_message = encodePacked(policy_client, intent_hash, user_signature)
app_digest  = keccak256(app_message)
app_sig     = Ed25519.sign(app_digest, app_private_key)
```

The application signature includes the user signature, creating a chain of authorization: if the user signature changes (different intent, different data refs), the application signature also changes.

### What Gets Bound

| Field | Bound In | Prevents |
|-------|----------|----------|
| `policy_client` | Both signatures | Cross-policy-client data reuse |
| `intent_hash` | Both signatures | Using data for a different transaction |
| `encrypted_data_refs` | User signature | Substituting different encrypted data |
| `user_signature` | App signature | Forging user consent |

## SecureEnvelope Format

A SecureEnvelope is the transport format for encrypted data:

```json
{
  "enc": "3b6a27bc...",           // X25519 encapsulated key (32 bytes hex)
  "ciphertext": "a1b2c3d4...",    // ChaCha20-Poly1305 ciphertext + tag (hex)
  "policy_client": "0x1234...",   // Policy client address
  "chain_id": 11155111,           // Chain ID
  "recipient_pubkey": "3b6a..."   // Gateway's X25519 public key (32 bytes hex)
}
```

The envelope is accompanied by:
- `signature`: Ed25519 signature over `JSON.stringify(envelope)` (64 bytes hex)
- `senderPublicKey`: The signer's Ed25519 public key (32 bytes hex)

## Key Management Best Practices

### Ed25519 Keys

- Generate fresh key pairs per user session or per application deployment
- Store private keys in secure storage (browser: IndexedDB with encryption, server: HSM or encrypted config)
- Never log or transmit private keys
- The SDK zeroes private key bytes from memory after use, but JavaScript's garbage collector may retain copies -- use secure storage APIs where available

### Gateway Public Key

- Fetch once via `getPrivacyPublicKey()` and cache locally
- The key changes only on gateway restart or explicit key rotation
- If decryption fails with "invalid ciphertext", re-fetch the key (it may have rotated)

### Encrypted Data References

- Data ref IDs are UUIDs -- they identify encrypted blobs on the gateway
- Refs are scoped to a policy client and chain
- Refs may have a TTL (time-to-live) -- expired refs will cause task creation to fail
- Do not reuse refs across different intents without re-authorizing (new dual signatures)

## Security Model

### What the Privacy Layer Protects

- **Network observers** cannot read encrypted data in transit or at rest
- **Other policy clients** cannot decrypt data scoped to a different policy client (AAD binding)
- **Unauthorized tasks** cannot reference encrypted data without valid dual signatures

### Current Limitations (Phase 1)

- The **gateway sees all plaintext** during decryption -- this is a centralized trust point
- Phase 2 introduces threshold DKG (Pedersen) where decryption is distributed across operators and no single party sees the full plaintext
- Authorization signatures are validated offchain by the gateway, not verified on-chain
- There is no on-chain audit trail of authorization events (planned for Phase 2)
