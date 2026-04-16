# Identity Architecture

## Popup Trust Model

The Newton Identity popup (`newton-identity` repo) is a standalone Next.js application that opens as a browser popup window. It serves as the **sole execution context** for identity owner operations.

### Why Not Iframe or Redirect?

| Approach | Problem |
|----------|---------|
| **Iframe** | Parent can access `contentWindow`, overlay CSS, inject scripts, intercept keyboard events |
| **Redirect** | Loses parent app context and user session — poor UX, state management complexity |
| **Popup** | Complete OS-level process isolation. Separate origin, separate storage, no DOM access from parent |

### Security Properties

| Property | How the Popup Provides It |
|----------|--------------------------|
| Key non-exposure | Turnkey credentials used only inside popup. Private key never leaves Turnkey enclave. Parent receives only signatures. |
| Consent enforcement | WebAuthn prompts and confirmation modals render in popup. Parent cannot fake or overlay them. |
| Origin isolation | Separate `localStorage`, `sessionStorage`, execution context. Parent cannot `contentWindow` into a popup. |
| Replay protection | EIP-712 signatures include on-chain nonce (from `IdentityRegistry.nonces()`) and 5-minute deadline |

## Components

### Identity Owner EOA (Master Key)

The identity owner's Ethereum address is their global identity authority. This single address:
- Owns all identity links across all Newton-integrated applications
- Signs EIP-712 messages authorizing link/unlink operations
- Signs encrypted identity data for gateway submission

The private key backing this address is managed by **Turnkey** — a non-custodial key infrastructure provider. The key lives in a hardware-backed secure enclave and is never exposed to any browser context.

### Turnkey WebAuthn Integration

Turnkey provides passkey-based authentication:

1. **Registration** — User creates a WebAuthn credential (fingerprint, Face ID, security key) tied to a Turnkey-managed Ethereum wallet
2. **Authentication** — User presents biometric/security key. Turnkey validates and returns an auth session
3. **Signing** — Popup calls `signRawPayload()` via Turnkey API. Turnkey signs the digest server-side and returns the signature

The `turnkeyProvider.ts` adapter wraps Turnkey as an EIP-1193 provider, enabling viem wallet clients to sign via Turnkey transparently.

### Popup Protocol (postMessage)

All parent-popup communication uses `window.postMessage()`:

```
Message Types:
  NEWTON_VC_POPUP_READY      popup → parent    Popup initialized, ready for requests
  NEWTON_VC_HANDLE_REQUEST   parent → popup    Dispatch RPC method with params
  NEWTON_VC_POPUP_RESPONSE   popup → parent    Return result or error
  NEWTON_VC_POPUP_EVENT      popup → parent    Intermediate status updates
```

**Parameter passing:** The `/handle` route parses `postMessage` params and stores them in `sessionStorage` (scoped to popup origin + tab lifetime). Parameters include:
- `dappUserAddress` — App's EOA address (the client user)
- `dappClientAddress` — PolicyClient contract address
- `apiKey` — Newton Gateway API key
- `chainId` — Target chain
- `appIdentityDomain` — bytes32 domain hash
- `userData` — KYC data blob (for register flow only)

### IdentityRegistry Contract

On-chain contract that manages the identity link graph.

**Reads:**
- `nonces(address)` — replay protection nonce for EIP-712 signatures
- `policyClientLinks(address, address, bytes32)` — query existing link

**Events:**
- `IdentityLinked(identityOwner, policyClient, policyClientUser, identityDomain)`
- `IdentityUnlinked(identityOwner, policyClient, policyClientUser, identityDomain)`

**Writes:**
- `linkIdentity(...)` — 3rd party submits with both signatures
- `linkIdentityAsSigner(...)` — identity owner submits with client user signature
- `linkIdentityAsSignerAndUser(...)` — caller is both parties
- `linkIdentityAsUser(...)` — client user submits with identity owner signature
- `unlinkIdentityAsSigner(...)` — identity owner revokes
- `unlinkIdentityAsUser(...)` — client user revokes

## EIP-712 Signatures

### Link Authorization

```
Domain: {
  name: "IdentityRegistry",
  version: "1",
  chainId: <target chain>,
  verifyingContract: <IdentityRegistry address>
}

Type: linkIdentitySigner {
  address identityOwner,
  address policyClient,
  address clientUser,
  bytes32[] identityDomains,
  uint256 identityOwnerNonce,
  uint256 deadline
}
```

The nonce is fetched from `IdentityRegistry.nonces(owner)` on-chain. The deadline is set to `block.timestamp + 300` (5 minutes).

<!-- TODO (HPKE migration): The EncryptedIdentityData EIP-712 type will be removed or replaced
     post-migration. Identity data signing will use Ed25519 envelope signatures instead of
     EIP-712, since HPKE envelopes are uploaded off-chain (not submitted via gateway RPC).
     The link authorization EIP-712 signatures are unaffected. -->

### Encrypted Identity Data

```
Domain: {
  name: "IdentityRegistry",
  version: "1",
  chainId: <target chain>,
  verifyingContract: <IdentityRegistry address>
}

Type: EncryptedIdentityData {
  string data
}
```

A single struct for all identity domains. The `data` field contains the encrypted blob (hex-encoded ciphertext). The `identity_domain` hash is passed separately in the RPC params, not inside the signed struct.

## Identity Domains

Identity data is organized by **domains** — namespaced categories that tell the gateway how to interpret the encrypted blob after decryption.

| Domain | Hash | Contains |
|--------|------|----------|
| `kyc` | `keccak256("kyc")` | KYC fields: status, country, birthdate, document dates |
| (future) | `keccak256("accreditation")` | Accreditation credentials |
| (future) | `keccak256("credit")` | Credit score data |

The single `EncryptedIdentityData { string data }` struct works across all domains because the data is encrypted — per-field wallet display would show ciphertext, providing no user benefit.

Rego policies access identity data via domain-namespaced built-ins:
```rego
# KYC domain
approved := newton.identity.kyc.check_approved()
country  := newton.identity.kyc.get("country")

# Cross-domain utility
field    := newton.identity.get("field_name")
```

<!-- TODO (HPKE migration): Update this flow when newton-prover-avs adds registerIdentityData.
     Phase 2 replaces steps 5-10 with:
     5. Popup derives Ed25519 key from Turnkey wallet (personal_sign + keccak256)
     6. Popup encrypts with HPKE via SDK createSecureEnvelope()
     7. Popup calls newt_uploadIdentityEncrypted → returns { data_ref_id, gateway_signature, deadline }
     8. Popup stores ref on-chain: registerIdentityData(domain, dataRefId, gatewaySig, deadline)
        (msg.sender is the identity owner)
     9. Gateway watches IdentityBound event → confirms storage
     The EIP-712 EncryptedIdentityData signing step is replaced by Ed25519 envelope signing.
     See docs/identity/hpke-migration.md for details. -->

## Data Flow: Register KYC Data

```
1. Parent app calls popupRequest({ method: "newton_vc_user_register_user_data", params: { userData, ... } })
2. Popup opens → user authenticates with Turnkey (WebAuthn)
3. Popup displays KYC fields for user review (country, birthdate, document dates)
4. User clicks "Submit"
5. Popup encrypts JSON-serialized KYC data with HPKE via createSecureEnvelope
   - Fetches gateway X25519 public key via newt_getPrivacyPublicKey
   - AAD binding: keccak256(policyClient, chainId)
6. Popup signs envelope JSON with EIP-712 (EncryptedIdentityData type)
   - Turnkey signs the EIP-712 digest via signRawPayload()
7. Popup calls newt_uploadIdentityEncrypted RPC to Newton Gateway
   - Params: { identity_owner, identity_owner_sig, envelope, identity_domain, chain_id }
8. Gateway validates EIP-712 signature against identity_owner
10. Gateway submits encrypted data to on-chain IdentityRegistry
11. Popup returns { inclusion_tx } to parent via postMessage
12. Popup auto-closes
```

## Data Flow: Link App

```
1. Parent app calls popupRequest({ method: "newton_vc_user_link_app", params: { ... } })
2. Popup opens → user authenticates with Turnkey
3. Popup fetches nonce from IdentityRegistry.nonces(identityOwner)
4. Popup builds EIP-712 typed data:
   - identityOwner, policyClient, clientUser, identityDomains[], nonce, deadline
5. User clicks "Authorize" → WebAuthn prompt
6. Turnkey signs the EIP-712 digest
7. Popup returns { signature, identityDomains, nonce, deadline, identityOwner } to parent
8. Parent combines owner signature with client user signature
9. Parent calls IdentityRegistry.linkIdentity() on-chain (via SDK or directly)
```

Note: The popup returns the **signature**, not a transaction. The parent app (or a relayer) submits the on-chain transaction with both signatures.

## Data Flow: Unlink

```
1. Parent app calls popupRequest({ method: "newton_vc_user_unlink", params: { ... } })
2. Popup opens → user authenticates with Turnkey
3. Popup fetches IdentityLinked/IdentityUnlinked events to compute active links
4. Popup deduplicates events (handles reorgs, duplicate logs)
5. User selects link to revoke and confirms in modal
6. Popup calls IdentityRegistry.unlinkIdentityAsSigner() on-chain
7. Popup waits for transaction receipt
8. Popup returns { success: true } to parent
```

Note: Unlike link, unlink is an **on-chain transaction** sent directly by the popup (the identity owner pays gas).
