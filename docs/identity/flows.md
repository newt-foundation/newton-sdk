# Identity Flows

End-to-end sequences for each identity operation. All flows originate from a parent application and execute through the Newton Identity popup.

## Flow 1: Connect

**Purpose:** Authenticate the identity owner and retrieve their Master Key address.

**Trigger:** Parent app calls `popupRequest({ method: 'newton_vc_user_connect' })`

```
Parent App                    Identity Popup                 Turnkey
    |                              |                           |
    |-- window.open(/handle) ----> |                           |
    |                              |-- render login page       |
    |                              |                           |
    |                              |   User clicks "Login"     |
    |                              |-- WebAuthn prompt ------> |
    |                              |   (fingerprint/Face ID)   |
    |                              |<-- auth session --------- |
    |                              |                           |
    |                              |-- fetch wallet address -> |
    |                              |<-- EOA address ---------- |
    |                              |                           |
    |<-- { address, email } -----  |                           |
    |                              |-- auto-close              |
```

**Result:** Parent app receives the identity owner's EOA address and email. No signing occurs.

**When to use:** First-time setup, session reconnection, or verifying which Master Key the user controls.

---

## Flow 2: Link App

**Purpose:** Authorize a Newton-integrated application to access identity data for a specific domain.

**Trigger:** Parent app calls `popupRequest({ method: 'newton_vc_user_link_app', params: { dappUserAddress, dappClientAddress, appIdentityDomain, chainId } })`

```
Parent App                    Identity Popup                 Turnkey          IdentityRegistry
    |                              |                           |                    |
    |-- window.open(/handle) ----> |                           |                    |
    |-- postMessage(params) -----> |                           |                    |
    |                              |-- WebAuthn prompt ------> |                    |
    |                              |<-- auth session --------- |                    |
    |                              |                           |                    |
    |                              |-- nonces(identityOwner) ----------------------> |
    |                              |<-- nonce ----------------------------------------|
    |                              |                           |                    |
    |                              |-- build EIP-712 data:     |                    |
    |                              |   { identityOwner,        |                    |
    |                              |     policyClient,         |                    |
    |                              |     clientUser,           |                    |
    |                              |     identityDomains[],    |                    |
    |                              |     nonce, deadline }     |                    |
    |                              |                           |                    |
    |                              |   User clicks "Authorize" |                    |
    |                              |-- signRawPayload -------> |                    |
    |                              |<-- signature ------------ |                    |
    |                              |                           |                    |
    |<-- { signature, nonce,       |                           |                    |
    |      deadline, domains,      |                           |                    |
    |      identityOwner } ------  |                           |                    |
    |                              |-- auto-close              |                    |
    |                                                                               |
    |-- (combine with clientUser signature)                                         |
    |-- linkIdentity(ownerSig, clientUserSig) ------------------------------------> |
    |<-- tx hash -------------------------------------------------------------------|
```

**Key detail:** The popup returns a **signature**, not a transaction. The parent app (or a relayer) submits the on-chain `linkIdentity()` call with both the identity owner's and client user's signatures.

**Deadline:** Set to `block.timestamp + 300` (5 minutes). The on-chain transaction must land within this window.

---

## Flow 3: Register User Data (KYC Submission)

**Purpose:** Encrypt and submit identity data to the Newton gateway, then register the data reference on-chain.

**Trigger:** Parent app calls `popupRequest({ method: 'newton_vc_user_register_user_data', params: { userData, appIdentityDomain, policyClient, apiKey, chainId } })`

```
Parent App                    Identity Popup                 Turnkey          Gateway
    |                              |                           |                |
    |-- window.open(/handle) ----> |                           |                |
    |-- postMessage(params) -----> |                           |                |
    |                              |-- WebAuthn prompt ------> |                |
    |                              |<-- auth session --------- |                |
    |                              |                           |                |
    |                              |-- display KYC fields      |                |
    |                              |   for user review         |                |
    |                              |                           |                |
    |                              |   User clicks "Submit"    |                |
    |                              |                           |                |
    |                              |-- 1. getPrivacyPublicKey ----------------> |
    |                              |<-- X25519 public key --------------------- |
    |                              |-- 2. createSecureEnvelope (HPKE encrypt)   |
    |                              |                           |                |
    |                              |-- 3. EIP-712 sign ------> |                |
    |                              |   EncryptedIdentityData   |                |
    |                              |   { data: envelopeJson }  |                |
    |                              |<-- signature ------------ |                |
    |                              |                           |                |
    |                              |-- 4. newt_uploadIdentityEncrypted -------> |
    |                              |   { identity_owner, identity_owner_sig,    |
    |                              |     envelope, identity_domain, chain_id }  |
    |                              |<-- { data_ref_id, gateway_signature } ---- |
    |                              |                           |                |
    |                              |-- 5. registerIdentityData on-chain         |
    |                              |   (domain, data_ref_id, gatewaySig)        |
    |                              |                           |                |
    |<-- { data_ref_id, tx_hash }  |                           |                |
    |                              |-- auto-close              |                |
```

**Steps inside the popup:**
1. Serialize KYC data to JSON
2. Encrypt with HPKE via `createSecureEnvelope` (gateway X25519 key fetched via `newt_getPrivacyPublicKey`)
3. Sign envelope JSON with EIP-712 (`EncryptedIdentityData { string data }`) via Turnkey
4. Submit envelope + signature to gateway via `newt_uploadIdentityEncrypted` RPC
5. Gateway returns `data_ref_id` + `gateway_signature` + `deadline`
6. Register on-chain via `registerIdentityData(domain, dataRefId, gatewaySig, deadline)`
7. Return `tx_hash` to parent

**The parent app never sees the plaintext KYC data.** The popup receives it, displays it for user confirmation, encrypts it, and submits it — all within the isolated popup context.

---

## Flow 4: Unlink

**Purpose:** Revoke an existing identity link between the identity owner and an application.

**Trigger:** Parent app calls `popupRequest({ method: 'newton_vc_user_unlink', params: { dappClientAddress, chainId } })`

```
Parent App                    Identity Popup                 Turnkey          IdentityRegistry
    |                              |                           |                    |
    |-- window.open(/handle) ----> |                           |                    |
    |-- postMessage(params) -----> |                           |                    |
    |                              |-- WebAuthn prompt ------> |                    |
    |                              |<-- auth session --------- |                    |
    |                              |                           |                    |
    |                              |-- getLogs(IdentityLinked) -------------------> |
    |                              |-- getLogs(IdentityUnlinked) -----------------> |
    |                              |<-- events ------------------------------------ |
    |                              |                           |                    |
    |                              |-- deduplicate events      |                    |
    |                              |-- compute active links    |                    |
    |                              |-- display link list       |                    |
    |                              |                           |                    |
    |                              |   User selects link       |                    |
    |                              |   User confirms "Unlink"  |                    |
    |                              |                           |                    |
    |                              |-- unlinkIdentityAsSigner(clientUser, --------> |
    |                              |     policyClient, domains[])                   |
    |                              |<-- tx receipt ---------------------------------|
    |                              |                           |                    |
    |<-- { success: true } ------  |                           |                    |
    |                              |-- auto-close              |                    |
```

**Key difference from Link:** Unlink sends an **on-chain transaction** directly from the popup (the identity owner pays gas). No counterparty signature is required — either party can unilaterally revoke.

**Event deduplication:** The popup fetches both `IdentityLinked` and `IdentityUnlinked` events, deduplicates them (handling reorgs and duplicate logs), and computes the set of currently active links. Only active links are shown for unlinking.

---

## Flow 5: Manage (View Active Links)

**Purpose:** Display the identity owner's active links across all applications.

**Trigger:** Parent app calls `popupRequest({ method: 'newton_vc_user_manage' })`

This flow is read-only — it fetches on-chain events, deduplicates them, and displays active links. No signing or transactions occur.

---

## Error Handling

All flows return errors via `postMessage` with the `NEWTON_VC_POPUP_RESPONSE` type:

| Error | Cause |
|-------|-------|
| `USER_REJECTED` | User closed the popup or declined the action |
| `AUTH_FAILED` | WebAuthn authentication failed |
| `TURNKEY_ERROR` | Turnkey API returned an error |
| `TX_FAILED` | On-chain transaction reverted |
| `GATEWAY_ERROR` | Newton Gateway RPC returned an error |
| `TIMEOUT` | Popup did not respond within the expected window |

The parent app should handle these gracefully — especially `USER_REJECTED`, which is a normal user action.
