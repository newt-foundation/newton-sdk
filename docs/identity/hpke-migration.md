# HPKE Migration: Cross-Repo Architecture

Long-term architecture for the Newton Verifiable Credential system across all three repositories as identity data encryption migrates from AWS KMS RSA-OAEP to Newton Privacy Layer HPKE.

## Current State (Phase 1)

Identity data is encrypted with RSA-OAEP (AWS KMS), EIP-712 signed, and stored as an encrypted blob directly on-chain in the IdentityRegistry contract.

```
newton-identity popup
  → RSA-OAEP encrypt (KMS public key, Web Crypto API)
  → EIP-712 sign (EncryptedIdentityData typehash, Turnkey wallet)
  → Gateway RPC: newt_sendIdentityEncrypted
  → Gateway calls submitIdentity(owner, domain, encryptedBlob)
  → On-chain: IdentityRegistry stores full encrypted blob (~512+ bytes)
  → At evaluation: Operators KMS-decrypt from on-chain storage
```

### Problems

- **AWS KMS dependency** — centralized encryption/decryption, not aligned with decentralized Newton
- **High gas costs** — storing ~512+ bytes of RSA ciphertext per identity registration
- **No cross-chain portability** — encrypted blobs stored per-chain; multi-chain requires replicating
- **No data update flexibility** — re-KYC requires full on-chain blob rewrite
- **GDPR non-compliance** — on-chain data is immutable; cannot satisfy deletion requests

## Target State (Phase 2)

Identity data encrypted with HPKE (matching the Newton SDK privacy module), stored off-chain in the gateway, with only a content-addressed `data_ref_id` (32 bytes) stored on-chain.

```
newton-identity popup
  → Derive Ed25519 key from Turnkey wallet (per identity domain)
  → HPKE encrypt (X25519 + HKDF-SHA256 + ChaCha20-Poly1305)
  → Ed25519 sign the envelope
  → Gateway RPC: newt_uploadIdentityEncrypted (off-chain storage)
  → Returns { data_ref_id, gateway_signature, deadline }
  → On-chain: registerIdentityData(domain, dataRefId, gatewaySig, deadline) — msg.sender is owner
  → At evaluation: Operators fetch envelope by ref → HPKE decrypt
```

## Cross-Repo Responsibilities

### newton-prover-avs (Gateway + Contracts)

| Component | Phase 1 (Current) | Phase 2 (HPKE) |
|-----------|-------------------|----------------|
| **Gateway RPC** | `newt_sendIdentityEncrypted` — accepts EIP-712 signed RSA blob | `newt_uploadIdentityEncrypted` — accepts HPKE envelope (off-chain) |
| **On-chain storage** | `submitIdentity(owner, domain, encryptedBlob)` — full blob | `registerIdentityData(domain, dataRefId, gatewaySig, deadline)` — msg.sender is owner |
| **Event** | (none specific) | `IdentityBound(address indexed identityOwner, bytes32 identityDomain, string identityData)` |
| **Decryption** | AWS KMS decrypt at evaluation time | HPKE decrypt from off-chain data store |
| **Cleanup** | N/A | Gateway GCs unconfirmed refs after 24h |

**Phase 2 gateway changes:**
1. Dedicated `newt_uploadIdentityEncrypted` endpoint (returns `{ data_ref_id, gateway_signature, deadline }`)
2. Store HPKE envelope off-chain, keyed by `data_ref_id = keccak256(envelope)`
3. Watch for `IdentityBound` events to confirm storage
4. Resolve `data_ref_id` → fetch envelope → HPKE decrypt at evaluation time
5. Phase out AWS KMS decrypt calls for identity data

**Phase 2 contract changes:**
1. New function: `registerIdentityData(bytes32 _identityDomain, string _dataRefId, bytes _gatewaySignature, uint256 _deadline)` — `msg.sender` is the identity owner
2. Gateway signs `REGISTER_IDENTITY_TYPEHASH = registerIdentityData(address identityOwner, bytes32 identityDomain, string dataRefId, uint256 deadline)`; contract verifies via `isTaskGenerator(recoveredSigner)`
3. New event: `IdentityBound(address indexed identityOwner, bytes32 identityDomain, string identityData)`
4. Fresh deploy (no production users yet — no backward compatibility needed)
5. Deprecate `submitIdentity` from new deployment

### newton-identity (Popup Wallet)

| Component | Phase 1 (Current) | Phase 2 (HPKE) |
|-----------|-------------------|----------------|
| **Encryption** | RSA-OAEP via AWS KMS public key (`kms.ts`) | HPKE via SDK privacy module (`createSecureEnvelope`) |
| **Signing** | EIP-712 `EncryptedIdentityData { string data }` | Ed25519 envelope signature (derived from Turnkey wallet) |
| **Upload** | `newt_sendIdentityEncrypted` (blob goes on-chain) | `newt_uploadIdentityEncrypted` (off-chain) + `registerIdentityData` (on-chain hash) |
| **Key source** | `NEXT_PUBLIC_KMS_PUBLIC_KEY` env var | Gateway X25519 key via `newt_getPrivacyPublicKey` RPC (no env var) |

**Phase 2 file changes:**

| File | Change |
|------|--------|
| `src/lib/kms.ts` | Delete — replaced by SDK privacy module |
| `src/utils/encrypt.ts` | Delete — superseded |
| New: `src/lib/privacyKey.ts` | Ed25519 key derivation from Turnkey wallet |
| `src/app/(pages)/rpc/register-user-data/page.tsx` | Replace `encryptSecret()` with HPKE flow |
| `src/lib/identityRegistry.ts` | Update or remove `EncryptedIdentityData` EIP-712 type |

**Ed25519 key derivation scheme:**
```typescript
const derivationMessage = `newton:ed25519:identity-privacy:v1:${identityDomain}`
const secp256k1Sig = await turnkeyProvider.request({
  method: 'personal_sign',
  params: [derivationMessage, ownerAddress],
})
const ed25519Seed = keccak256(secp256k1Sig).slice(2) // 32 bytes hex
```

Properties:
- Deterministic — same wallet + domain always produces same Ed25519 key
- Per-domain isolation — compromise of one domain doesn't affect others
- No separate key management — derived from existing Turnkey wallet

### newton-sdk

| Component | Phase 1 (Current) | Phase 2 (HPKE) |
|-----------|-------------------|----------------|
| **Identity data submission** | None (popup calls gateway directly) | `newt_uploadIdentityEncrypted` called by popup directly; `registerIdentityData()` wraps on-chain hash storage |
| **Link/unlink** | `linkIdentity*()` / `unlinkIdentity*()` | Unchanged |
| **Domain hash** | `identityDomainHash()` | Unchanged |
| **Privacy module** | Used for general privacy data | Also used for identity data encryption |

**Phase 2 SDK changes:**
1. Ensure privacy module exports are public (`createSecureEnvelope`, `getPrivacyPublicKey`, `generateSigningKeyPair`)
2. Add `registerIdentityData` writeContract wrapper (when contract lands)
3. Update `docs/privacy/` to cover identity data use case

## End-to-End Flows

### Phase 2: Register User Data (KYC Submission)

```
Parent App                    Identity Popup              SDK Privacy    Gateway         Chain
    |                              |                       Module          |               |
    |-- popupRequest(register) --> |                         |             |               |
    |                              |-- WebAuthn auth ------> Turnkey       |               |
    |                              |                         |             |               |
    |                              |-- 1. getPrivacyPublicKey() ---------> |               |
    |                              |<-- X25519 public key ----------------|               |
    |                              |                         |             |               |
    |                              |-- 2. personal_sign(derivation_msg) -> Turnkey         |
    |                              |<-- secp256k1 signature -------------- Turnkey         |
    |                              |-- 3. keccak256(sig) → Ed25519 seed   |               |
    |                              |                         |             |               |
    |                              |-- 4. createSecureEnvelope() -------> |               |
    |                              |   (HPKE encrypt + Ed25519 sign)      |               |
    |                              |<-- envelope + signature              |               |
    |                              |                         |             |               |
    |                              |-- 5. newt_uploadIdentityEncrypted --> |               |
    |                              |<-- { data_ref_id, gateway_sig,       |               |
    |                              |      deadline }                       |               |
    |                              |                         |             |               |
    |                              |-- 6. registerIdentityData() ----------------------------> |
    |                              |   (domain, dataRefId, gatewaySig, deadline)               |
    |                              |   msg.sender = identityOwner                               |
    |                              |<-- tx receipt --------------------------------------------|
    |                              |                         |             |               |
    |                              |                         |      7. watch event ------> |
    |                              |                         |      IdentityBound          |
    |                              |                         |      → confirm storage      |
    |                              |                         |             |               |
    |<-- { data_ref_id, tx } ----  |                         |             |               |
```

### Phase 2: Policy Evaluation (Identity Data Access)

```
Client App           Gateway              Off-chain Store       Operators
    |                    |                       |                    |
    |-- newt_createTask --> |                    |                    |
    |   (intent + policyClient)                  |                    |
    |                    |                       |                    |
    |                    |-- resolve data_ref_id from IdentityRegistry
    |                    |-- fetch envelope ---> |                    |
    |                    |<-- HPKE envelope ---- |                    |
    |                    |-- HPKE decrypt        |                    |
    |                    |-- inject plaintext as data.identity.*      |
    |                    |                       |                    |
    |                    |-- broadcast task + plaintext ------------> |
    |                    |                       |         evaluate Rego policy
    |                    |                       |         newton.identity.kyc.*
    |                    |                       |         BLS sign result
    |                    |<-- aggregated attestation ----------------|
    |<-- attestation --- |                       |                    |
```

## User Experience

The user experience is identical across Phase 1 and Phase 2. The migration is invisible to end users:

1. User opens the Newton Identity popup (via parent app)
2. User authenticates with passkey (WebAuthn)
3. User reviews their KYC data fields
4. User clicks "Submit"
5. Popup encrypts, signs, and uploads (implementation changes, UX doesn't)
6. Popup shows confirmation with transaction hash
7. Popup auto-closes

The only observable difference: Phase 2 involves two transactions (upload + register ref) vs Phase 1's single gateway RPC. The popup handles both transparently.

## Design Rationales

### Why Hybrid Storage (Off-chain + On-chain Hash)?

| Concern | On-chain blob (Phase 1) | Off-chain + hash (Phase 2) |
|---------|------------------------|---------------------------|
| Gas cost | ~512+ bytes per registration | 32 bytes per registration (10-15x savings) |
| Cross-chain | Replicate full blob per chain | One blob, N chain references |
| Data updates | Full blob rewrite | New envelope + update 32-byte pointer |
| GDPR | Immutable on-chain | Off-chain data can be TTL'd or deleted |
| Verification | Trust gateway | Content-addressed: `keccak256(envelope) == on-chain ref` |

### Why Content-Addressed data_ref_id?

`data_ref_id = keccak256(serialized_envelope)` — deterministic, no central ID authority. Each upload produces a distinct hash (different ephemeral HPKE keys), preserving audit trail. Anyone can verify integrity by re-hashing the stored envelope.

### Why Ed25519 Key Derivation (Not Separate Key Management)?

Deriving Ed25519 keys from the Turnkey secp256k1 wallet via `personal_sign`:
- No separate key backup or management for users
- Per-domain isolation (different derivation message per domain)
- Deterministic — key can be re-derived if needed
- Key loss is tied to Turnkey wallet loss (same recovery path)

### Why HPKE Over Continuing KMS?

- **Decentralization** — KMS is a centralized AWS dependency; HPKE uses the gateway's own X25519 key
- **Unification** — same encryption path for identity data and general privacy data
- **AAD binding** — HPKE binds ciphertext to (policyClient, chainId), preventing cross-context replay
- **Phase 3 path** — HPKE keys can be distributed via threshold DKG (Pedersen) across operators

### Why Two Steps (Upload + Register) Instead of One RPC?

The two-step pattern (off-chain upload, then on-chain ref registration):
- Popup handles the on-chain tx — avoids gateway gas costs and nonce contention at scale
- Event-based confirmation — gateway watches `IdentityBound`, no extra RPC needed
- Atomicity gap handled naturally — gateway GCs unconfirmed refs after 24h
- Same pattern as existing chain watcher infrastructure for identity link/unlink events

## What Doesn't Change

These components are unaffected by the migration:

- **Identity linking** — EIP-712 `linkIdentitySigner` signatures, link/unlink contract calls
- **Turnkey wallet management** — WebAuthn, passkeys, key custody
- **Popup communication protocol** — `postMessage` types, parameter passing
- **On-chain link/unlink event sourcing** — `IdentityLinked` / `IdentityUnlinked` events
- **Rego policy built-ins** — `newton.identity.kyc.*` functions
- **Identity domains** — domain hash computation, domain separation model

## HPKE Cipher Suite

Must match across all three repos:

| Component | Algorithm | Implementation |
|-----------|-----------|---------------|
| KEM | X25519 (DHKEM) | `@hpke/core` / `DhkemX25519HkdfSha256` |
| KDF | HKDF-SHA256 | `@hpke/core` / `HkdfSha256` |
| AEAD | ChaCha20-Poly1305 | `@hpke/chacha20poly1305` / `Chacha20Poly1305` |
| Mode | Base | No pre-shared key |

AAD binding: `keccak256(abi.encodePacked(policy_client_address, chain_id_be_u64))`

Matches:
- Rust gateway: `crates/core/src/crypto/hpke.rs`
- SDK privacy module: `src/modules/privacy/index.ts`

## Open Questions

1. **Resolved**: Gateway signs `REGISTER_IDENTITY_TYPEHASH` = `registerIdentityData(address identityOwner, bytes32 identityDomain, string dataRefId, uint256 deadline)`. The contract verifies via `isTaskGenerator(recoveredSigner)`, confirming the data ref was uploaded to the gateway before on-chain registration.
2. Gateway X25519 public key caching strategy for newton-identity (recommendation: 1-hour TTL)
3. Phase 3 threshold DKG — will identity data decryption be distributed to operators or remain gateway-only?

## Related Resources

- [Newton VC Product Spec](https://www.notion.so/magiclabs/Newton-Verifiable-Cred-VC-Product-Specification-v0-2e9ad65b2b7080faa8eac75655aaa6b8)
- [Newton Privacy Layer (Linear)](https://linear.app/magiclabs/project/newton-privacy-layer-e360cf0b6436/overview)
- [Newton VC (Linear)](https://linear.app/magiclabs/project/newton-verifiable-credential-ed6073c1c056/issues)
- [newton-identity HPKE Migration Plan](https://github.com/newt-foundation/newton-identity/blob/main/docs/HPKE_MIGRATION.md)
- [Newton SDK Privacy Docs](../privacy/README.md)
- [RFC 9180: HPKE](https://www.rfc-editor.org/rfc/rfc9180)
