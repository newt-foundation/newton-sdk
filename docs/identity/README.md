# Newton Identity Layer - Developer Guide

Identity management for the Newton Verifiable Credential system.

The Newton identity layer enables users to link verified identity data (KYC, accreditation, credentials) to on-chain policy evaluation. Identity data is encrypted client-side, signed with EIP-712, and submitted to the Newton gateway. On-chain links associate an identity owner with specific policy clients, allowing Rego policies to gate transactions based on identity attributes.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](architecture.md) | Popup trust model, key isolation, cross-origin security |
| [Concepts](concepts.md) | Identity domains, EIP-712 signing, link/unlink mechanics, encryption |
| [Flows](flows.md) | End-to-end sequences for connect, link, unlink, and register |
| [HPKE Migration](hpke-migration.md) | Long-term cross-repo architecture: AWS KMS → Newton Privacy Layer |

## Architecture Overview

The identity system uses a **popup-based trust architecture**. The identity owner's private key (Owner EOA) is custodied by Turnkey and accessed only via WebAuthn (passkeys). A popup window isolates all signing operations from the parent application.

```
Parent App (dApp)                 Newton Identity Popup              Turnkey Enclave
      |                                    |                              |
      |-- 1. window.open() ------------->  |                              |
      |                                    |-- POPUP_READY ------------> |
      |-- 2. postMessage(request) ------>  |                              |
      |                                    |-- 3. WebAuthn prompt ------> |
      |                                    |<-- auth session ------------ |
      |                                    |                              |
      |                                    |-- 4. HPKE encrypt (createSecureEnvelope) --|
      |                                    |-- 5. EIP-712 sign ---------> |
      |                                    |<-- signature --------------- |
      |                                    |                              |
      |                                    |-- 6. newt_uploadIdentityEncrypted --> Gateway
      |                                    |<-- data_ref_id + gatewaySig --------- Gateway
      |                                    |-- 7. registerIdentityData on-chain -->|
      |                                    |                              |
      |<-- 7. postMessage(result) ------  |                              |
      |                                    |-- auto-close                 |
```

## Why a Popup?

The popup is a **trust-enabling isolation layer**, not a UX preference. It solves three critical problems:

1. **Key isolation** — The identity owner's Master Key lives in Turnkey's secure enclave. The popup is the only context that authenticates with Turnkey. The parent app never sees the key, Turnkey credentials, or auth tokens.

2. **Consent enforcement** — Each identity operation (link, unlink, register data) requires explicit user approval via WebAuthn biometric/security key prompt. The parent app cannot forge, bypass, or overlay these prompts because they run in a separate OS-level window.

3. **Cross-app safety** — The Master Key is global across all Newton-integrated applications. If a parent app could access it, a compromised app would compromise the identity across all integrated apps. The popup ensures no single integrator can exfiltrate the key.

See [Architecture](architecture.md) for the full trust model.

## Two Layers

The identity system operates across two layers:

| Layer | What | Who Calls It |
|-------|------|-------------|
| **Gateway RPC** | `newt_uploadIdentityEncrypted` — submit HPKE-encrypted identity data with EIP-712 signature | Newton Identity popup only (not wrapped by SDK) |
| **On-chain** | `linkIdentity*` / `unlinkIdentity*` — associate/revoke identity-to-PolicyClient links on IdentityRegistry | Parent app via SDK, or popup directly |

The gateway layer handles encrypted data submission. The on-chain layer manages the public identity link graph that Rego policies query at evaluation time.

## Relationship to Newton SDK

The Newton SDK (`@magicnewton/newton-protocol-sdk`) provides TypeScript wrappers for the on-chain layer:

- `registerIdentityData()` — store identity data reference on-chain with gateway co-signature
- `identityDomainHash()` — compute keccak256 domain identifier
- `linkIdentity*()` / `unlinkIdentity*()` — on-chain writeContract calls

The gateway RPC layer (`newt_uploadIdentityEncrypted`) is called directly by the newton-identity popup, not wrapped by the SDK. The popup uses the SDK's privacy module (`createSecureEnvelope`, `getPrivacyPublicKey`, `generateSigningKeyPair`) for HPKE encryption.

## Encryption

| | Details |
|---|---|
| **Encryption** | HPKE (X25519 KEM + HKDF-SHA256 + ChaCha20-Poly1305, RFC 9180) |
| **Key management** | Gateway X25519 public key via `newt_getPrivacyPublicKey` |
| **Where it happens** | Inside newton-identity popup, using SDK's `createSecureEnvelope` |
