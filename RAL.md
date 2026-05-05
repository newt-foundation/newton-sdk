# RAL.md — PR #151 denniswon review resolution plan

## Scope source

- PR: https://github.com/newt-foundation/newton-sdk/pull/151
- Branch: `feat/move-zktls-examples-to-sdk`
- Reviewer: `denniswon`
- Files read for planning: all files under `examples/zktls-twitter/sdk/src/`, all files under `examples/zktls-twitter/demo/src/services/`, and `docs/zktls-twitter/README.md`.

## Decision summary

This plan resolves the inline review comments with the smallest review-focused diff: make the zkTLS helper package explicitly example-scoped, align authentication headers with the main SDK, document shallow conversion and roadmap constraints, fix the WebSocket/hex-string issues, rename the mocked flow tests to integration tests, and add the identity/Mintlify roadmap docs.

A later PR conversation comment from `denniswon` clarified that the long-term preferred direction is a thin zkTLS extension over `@magicnewton/newton-protocol-sdk`, not a parallel SDK. This plan records that structural direction in package/docs comments and the identity roadmap, while keeping this commit scoped to the review-requested changes listed below rather than performing a broad main-SDK refactor inside the example PR.

## Per-comment resolution plan

| ID | Source comment | File / line | Exact code change | Rationale |
| --- | --- | --- | --- | --- |
| 1 | SDK relationship to main package / package naming | `examples/zktls-twitter/sdk/src/index.ts` original PR line 88; current lines 1-10 and 96-123. `examples/zktls-twitter/sdk/package.json` line 2. `examples/zktls-twitter/sdk/README.md` lines 1-10. Demo import sites listed in item 11. | Rename the package from `@newton-protocol/sdk` to `@newton-protocol/zktls-twitter-example`. Add top-level and factory comments saying this is example-scoped and production integrations should use `@magicnewton/newton-protocol-sdk` for gateway/task/identity/privacy/secrets, composing only zkTLS-specific helpers from this example. Update SDK README title/install/import examples with the new package name and production-boundary note. | Makes the package boundary explicit, reduces confusion with the main SDK, and documents the main-SDK composition direction without expanding this review fix into a full structural refactor. |
| 2 | Gateway auth header alignment | `examples/zktls-twitter/sdk/src/gateway.ts` original PR line 45; current lines 54-57. Tests: `examples/zktls-twitter/sdk/src/gateway.test.ts` auth test and `examples/zktls-twitter/sdk/src/integration.test.ts` createTask assertion. SDK README config line. | Replace `this.headers["x-newton-secret"] = config.apiKey` with `this.headers["Authorization"] = \`Bearer ${config.apiKey}\``. Update tests to assert `Authorization: Bearer <apiKey>` and README config text to state gateway and attester both use bearer auth. | Aligns example gateway auth with `ProofClient`, `AttesterClient`, and the main SDK's bearer-token convention. |
| 3 | `camelToSnake` shallow conversion documentation | `examples/zktls-twitter/sdk/src/gateway.ts` original PR line 137; current lines 164-180. `examples/zktls-twitter/sdk/src/utils.ts` current lines 45-52. | Expand the `GatewayClient.call` comment to state that only top-level params are converted, nested objects intentionally pass through, `intent` is the known camelCase exception, and future nested snake_case shapes need explicit converters. Mirror that contract in the `camelToSnake` JSDoc. | Documents the intentional shallow conversion so future nested RPC params do not silently rely on an incorrect recursive assumption. |
| 4 | WebSocket cleanup after `sessionRegistered` | `examples/zktls-twitter/sdk/src/attester.ts` original PR line 78; current lines 94-104. | Add `ws.close();` immediately when `data.type === "sessionRegistered"` before resolving the session handle. | The `/session` socket is only needed for the registration handshake; closing it avoids leaked sockets. |
| 5 | Hex string empty-input guard | `examples/zktls-twitter/sdk/src/utils.ts` original PR line 17; current lines 23-30. Tests: `examples/zktls-twitter/sdk/src/utils.test.ts` decode tests. | Import `NewtonSDKError`, store `stripped.match(/.{1,2}/g)` in `matches`, throw `new NewtonSDKError("Invalid hex string: empty input")` when `matches` is null, then map matches to bytes. Add tests for `decodeWasmArgs("0x")` and `decodeWasmArgs("")`. | Replaces an unhelpful null non-null assertion failure with a domain error and locks behavior with regression coverage. |
| 6 | Address type TODO | `examples/zktls-twitter/sdk/src/types.ts` original PR line 14; current lines 11-18. | Add a TODO above `export type Address = string` noting that if the example package graduates beyond tutorial/demo scope it should re-export viem's branded `Address` type from the main SDK or narrow to `` `0x${string}` ``. | Acknowledges the type-safety gap while preserving the lightweight example scope. |
| 7 | Rename misleading test file | `examples/zktls-twitter/sdk/src/e2e.test.ts` original PR line 10; new file `examples/zktls-twitter/sdk/src/integration.test.ts` current lines 1-14. | Rename `e2e.test.ts` to `integration.test.ts`, update the file header from “E2E-style” to “Integration tests”, and update the `describe` label from `E2E` to `Integration`. | The tests use mocked fetch responses, so “integration” better describes request/response contract coverage than live end-to-end testing. |
| 8 | Identity-integration roadmap | `examples/zktls-twitter/demo/src/services/newtonFlow.ts` original PR line 148; docs target `docs/zktls-twitter/README.md` current lines 35-58. | Add an “Identity integration roadmap” section explaining the current proof → IPFS → `proofCid` flow and the future optional `tls_proof` field on `newt_uploadIdentityEncrypted`. Include protocol, SDK, and UX follow-up bullets intended for Linear tracking. | Documents the critical next milestone without blocking the example merge and gives the protocol/SDK/UX owners a concrete checklist. |
| 9 | ProofClient future evolution | `examples/zktls-twitter/sdk/src/proof.ts` original PR line 8; current lines 1-13. SDK README lines 159-168. | Add a file-level note that IPFS proof archival is for the standalone demo and that the identity-integrated flow should make `ProofClient` optional archival tooling. Add the same conceptual note to the SDK README ProofClient section. | Helps developers understand that IPFS storage is not the intended final identity-backed flow. |
| 10 | Mintlify site cross-reference | `docs/zktls-twitter/README.md` original PR line 3; current lines 60-67. | Add a “Mintlify docs-site follow-up” section requiring a `site/developers/guides/zktls-twitter.mdx` page and `site/docs.json` navigation entry under Developers → Guides, while keeping this markdown pack as source if preferred. | Makes discoverability gap explicit for docs.newton.xyz users and records non-blocking publishing work. |
| 11 | Package/import path updates after rename | `examples/zktls-twitter/demo/package.json` line 17; `examples/zktls-twitter/demo/tsconfig.json` lines 29-32; `examples/zktls-twitter/demo/vite.config.ts` line 9; demo imports in `src/App.test.tsx`, `src/newtonFlow.ts`, `src/services/newtonFlow.ts`, `src/services/newtonFlow.test.ts`, `src/tlsnPlugin.ts`, and `src/types.ts`; `examples/zktls-twitter/demo/pnpm-lock.yaml`. | Replace all demo package references/import specifiers from `@newton-protocol/sdk` to `@newton-protocol/zktls-twitter-example`. Update the file dependency and lockfile keys to the new package name. | Keeps local demo builds resolving the renamed example package and prevents stale import paths. |
| 12 | Later global SDK-boundary clarification | PR issue comment `4322188047`; no single inline file line. Documentation/code touchpoints: `index.ts`, SDK README, docs roadmap. | Record that the long-term target is composition with `@magicnewton/newton-protocol-sdk`; keep this patch as example-scope cleanup and defer the full thin-extension refactor to follow-up planning because it would change gateway/task implementation boundaries across the example. | Avoids silently ignoring the later clarification while preventing an oversized refactor from being hidden in a review-comment fix commit. |

## Verification plan

1. Run SDK tests in `examples/zktls-twitter/sdk`: `npm test -- --run`.
2. Run SDK build in `examples/zktls-twitter/sdk`: `npm run build`.
3. Run demo typecheck/tests if the local Node version satisfies the demo engine (`>=20.19.0`); otherwise record the engine blocker and run the SDK checks that match the edited source package.
4. Grep for stale `@newton-protocol/sdk`, `e2e.test.ts`, and SDK gateway `x-newton-secret` references under `examples/zktls-twitter`.
5. Review `git diff --check` and `git status` before commit.

## PR reply checklist

- Confirm package rename and production main-SDK boundary note.
- Confirm gateway bearer auth alignment.
- Confirm shallow `camelToSnake` documentation.
- Confirm `AttesterClient.createSession()` closes the session WebSocket.
- Confirm `decodeWasmArgs()` empty input guard and test.
- Confirm Address TODO.
- Confirm integration test rename.
- Confirm identity roadmap and ProofClient evolution docs.
- Confirm Mintlify follow-up note.
- Confirm package/import path updates and verification commands.
