# Extension Demo Strategy and Deltas

Reference reviewed: `newt-foundation/newton-tlsn-extension-demo`.

## What the extension demo adds

The extension demo provides the missing first-user UX layer:

1. Browser extension opens/manages target pages such as x.com.
2. Plugin intercepts browser requests and headers through extension capabilities.
3. Plugin calls `prove()` to generate a TLSNotary proof with selective disclosure handlers.
4. Sidecar/verifier stores the proof through `/v1/proof/store` and returns a CID.
5. Plugin submits `newt_createTask(proofCid)` to the Newton gateway.

Relevant reference paths in the extension repo:

```text
packages/newton-plugin/newton.plugin.js      # proof-to-task flow
packages/extension/                          # Chrome extension shell
packages/verifier/                           # verifier/proxy sidecar
PLUGIN.md                                    # plugin capability model
VERIFIER.md                                  # /session, /verifier, /proxy, /proof/store concepts
```

## Deltas versus the current tutorial approach

| Area | Current PR #572/tutorial pack | Extension-demo strategy | Required tutorial delta |
| --- | --- | --- | --- |
| User starting point | User already has a proof CID | User starts in browser on x.com | Add extension-first path before CLI payload generation |
| Proof generation | Not covered beyond placeholders | `prove()` from extension plugin | Document extension repo as the real proof-generation UX |
| Secrets/cookies | Not touched by CLI | Browser extension can observe auth headers | Add explicit no-secret logging guidance and selective disclosure notes |
| Proof storage | Assumed CID exists | Sidecar `/v1/proof/store` returns CID | Add proof CID handoff from sidecar to this repo's SDK script |
| Task submission | `scripts/zktls-twitter-sdk-demo.sh` builds/submits payload | Plugin can call gateway directly | Offer two submission modes: plugin direct or copy CID into script |
| Local stack | Docker gateway/operator | Extension verifier + browser + gateway/operator | Clarify two local services: extension sidecar/verifier and Newton gateway stack |

## Recommended external-user flow

1. **Browser proof path** — Use `newton-tlsn-extension-demo` to generate a real proof against x.com/API traffic.
2. **Proof CID handoff** — Copy the returned CID from sidecar/plugin output.
3. **Newton task path** — Use this repo's `scripts/zktls-twitter-sdk-demo.sh --proof-cid <CID>` for a transparent, inspectable gateway request.
4. **Operator verification path** — Run local stack or testnet gateway with trusted TLSNotary key configured.

This keeps the first tutorial simple while still aligning with the production UX: browser extension for proof generation, Newton gateway/operator stack for verification and policy attestation.

## What to reuse/adapt from the extension demo

Reuse concepts:

- Managed browser window and request/header interception.
- Selective disclosure handler language: reveal only request line, response status/date, and needed JSON fields.
- Sidecar/verifier health check and `/v1/proof/store` as the proof-to-CID boundary.
- Plugin UX states: detect request → generate proof → store proof → submit task.

Adapt for this repo:

- Replace hardcoded plugin gateway payload with the JSON shape in `examples/zktls-twitter/configs/create-task.json`.
- Keep gateway API key out of plugin source; pass via runtime config or demo-only environment.
- Add a “copy proof CID into CLI script” fallback for users not ready to submit directly from the extension.
- For `x.com/realsigridjin`, prefer proving public profile/API traffic only. Do not instruct users to export cookies or tokens.

## Tutorial publishing note

Publish this tutorial pack with a pointer to the extension demo as the recommended proof generator. The current CLI-only path remains useful as a 10-minute payload quickstart and troubleshooting tool.
