# zkTLS Twitter SDK — Client-Side Invariants

This doc catalogs the invariants the example SDK enforces against gateway and attester responses. Each invariant exists because the gateway/attester are external trust boundaries: a misconfigured (or compromised) backend could otherwise return content the client never asked for, or exhaust client memory with unbounded payloads.

The implementations live in:

- `examples/zktls-twitter/sdk/src/proof.ts` — IPFS proof storage and retrieval
- `examples/zktls-twitter/sdk/src/attester.ts` — TLSNotary attester WebSocket lifecycle
- `examples/zktls-twitter/sdk/src/gateway.ts` — Newton gateway JSON-RPC client
- `examples/zktls-twitter/sdk/src/index.ts` — `encodeWasmArgs` / `decodeWasmArgs`

Tests for every invariant are co-located in `*.test.ts` next to each module.

---

## 1. Content-addressable CID verification

`ProofClient.store(proof)` and `ProofClient.retrieve(cid)` both verify that the bytes they hand to the caller actually hash to the CID the gateway returned (or that the caller supplied).

### `store(proof)`

1. Decode the base64 proof into raw bytes.
2. POST to `/v1/proof/store`.
3. Receive `{ cid, url }` from the gateway.
4. **Re-derive the CID locally** from the bytes uploaded.
5. Compare to the gateway-returned CID; throw `CID integrity check failed` on mismatch.

This prevents a malicious or misconfigured gateway from substituting an unrelated CID. Without this check, downstream `proofCid` task submissions could resolve to content the client never authored.

### `retrieve(cid)`

1. GET `/v1/proof/<urlEncodedCid>`.
2. Read body bytes.
3. **Hash the returned bytes** with sha2-256.
4. Compare to the multihash embedded in the requested CID; throw on mismatch.

This guards against tampered IPFS content.

### Multihash algorithm guard

Both paths reject CIDs whose multihash code is not `sha256.code` (multicodec `0x12`):

```
CID integrity check unsupported: multihash algorithm <code> is not sha-256
```

The example SDK does not yet support sha2-512 or blake3 hashes; if the upstream service starts using a different algorithm, both the verification function and the test fixtures must be updated together.

---

## 2. WebSocket oneshot lifecycle

`AttesterClient.createSession()` and `AttesterClient.reveal()` each open a single WebSocket connection, send one request frame, await one terminal message, and then close. The lifecycle uses three coordinated guards:

### Settled flag

A boolean `settled` is set the first time the per-request promise resolves or rejects. Subsequent terminal events (a late `onmessage`, a timeout firing after success, a `close` after error) check the flag and become no-ops. Without this guard, a stale `onmessage` could double-resolve a promise that already rejected on timeout, leaving the caller's await chain in undefined state.

### Always-close on terminal paths

Every terminal path closes the socket: success, server error message (`type: "error"`), WebSocket protocol error (`onerror`), timeout fire, premature close (`onclose` before completion). The `close` call is idempotent — calling it after the socket already moved to state `3` (CLOSED) is a no-op.

### 1 MB per-frame guard

Each `onmessage` frame's `data` length is checked against a 1 MB cap:

```
WebSocket frame exceeds 1 MB
```

Legitimate `sessionRegistered` and `sessionCompleted` payloads are well under this. The cap protects against a malicious or misconfigured attester exhausting client memory.

### Snake_case message acceptance

The SDK accepts both camelCase (`sessionRegistered`, `sessionCompleted`) and snake_case (`session_registered`, `session_completed`) message types because the upstream sidecar emits the snake_case form while older test harnesses use camelCase. Both shapes are first-class.

---

## 3. Bounded HTTP body reads

Every fetch in the SDK uses an `AbortController` plus a streaming reader to enforce an explicit body cap. The cap depends on the endpoint:

| Endpoint | Cap | Rationale |
|---|---|---|
| Gateway JSON-RPC (`/rpc`) | 1 MiB | Normal JSON-RPC responses are kilobytes; oversized bodies indicate a misconfigured proxy or HTML error page |
| Proof retrieval (`/v1/proof/<cid>`) | 50 MiB | Matches the operator-side proof size limit on prover-AVS |
| Proof store error body | 1 MiB | Same as gateway JSON-RPC |
| `wasmArgs` decoded JSON | 50 MiB hex (encoded) | Inline WASM args should be small; large data goes through `proofCid` |

### Streaming with `reader.cancel()`

The bounded read uses `response.body.getReader()` and an out-of-band timer. Two failure paths exist:

1. **Body too large**: the byte counter exceeds the cap → call `reader.cancel()`, throw an error naming the cap.
2. **Timeout**: the timer fires → set a `timedOut` flag, call `reader.cancel()`, distinguish the cancel-induced EOF from a clean EOF, throw `TimeoutError`.

`AbortController` alone is insufficient because it cannot interrupt an in-flight `reader.read()` — only `reader.cancel()` can.

### Eager fallback path

For environments without `response.body` (test mocks, minimal polyfills), the SDK falls back to `response.arrayBuffer()` and gates on `byteLength` after the read completes. The outer `AbortController` still bounds wall-clock time.

---

## 4. JSON-RPC wire convention

The Newton gateway accepts top-level params in snake_case (`policy_client`, `use_two_phase`, `proof_cid`, `wasm_args`) but tolerates the nested `intent` object in camelCase (`from`, `to`, `value`, `data`, `chainId`, `functionSignature`).

### Top-level conversion

The SDK converts top-level keys via:

```javascript
key.replace(
  /([a-z0-9])([A-Z])|([A-Z])([A-Z][a-z])/g,
  "$1$3_$2$4",
).toLowerCase();
```

The two-arm regex handles two distinct word-boundary patterns:

- **Arm 1** `([a-z0-9])([A-Z])`: lowercase→uppercase boundary. `useTwoPhase` → `use_two_phase`.
- **Arm 2** `([A-Z])([A-Z][a-z])`: consecutive caps where the second cap starts a lowercase word. `URLPath` → `URL_Path` → `url_path`.

A naive single-arm regex would mangle PascalCase acronyms (`URL` → `u_r_l`).

### Nested objects untouched

Nested objects (such as `intent`) are not recursively converted because the gateway parses them in camelCase. If you add a new top-level param that contains a nested object, verify the gateway accepts the casing you ship.

---

## 5. WASM args size cap

`encodeWasmArgs(json)` and `decodeWasmArgs(hex)` enforce a 50 MiB hex cap on the encoded form (~25 MiB of source JSON). The cap matches the operator-side proof size limit on prover-AVS, so a payload that fits in `wasmArgs` will also fit when the operator decodes it.

For genuinely large data (model weights, large datasets), use `proofCid` to point at IPFS-stored content and pass only the CID inline.

---

## 6. Multiformats compat shim

The SDK depends on `multiformats@^9.9.0` and bundles a structural type declaration in `src/multiformats-compat.d.ts`. The shim describes:

- `CID.parse(string).multihash.{code, bytes}`
- `CID.createV1(codec, digest).toString()`
- `sha256.code`
- `sha256.digest(bytes).bytes`

The shim is structural, not nominal — if `multiformats` ships a major version bump that changes the shape (e.g., `multihash` becomes a getter that returns a different type), the shim and every call site must be updated together.

The shim exists because the package's own type declarations have known compatibility issues with strict TypeScript; the structural form is narrower and more reliable for the small surface the SDK uses.

---

## 7. Test fixture discipline

When introducing a new content-addressable check (CID, hash, signature over bytes), every test mock that supplies the verified value must construct the fixture from the same source the production code uses. The reference pattern in `integration.test.ts`:

```typescript
const proofBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const proofBase64 = bytesToBase64(proofBytes);
const proofCid = await cidFor(proofBytes);

mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ cid: proofCid, url: `https://ipfs.example.com/ipfs/${proofCid}` }),
});

const result = await sdk.proof.store(proofBase64);
expect(result.cid).toBe(proofCid);
```

`cidFor(proofBytes)` derives the expected CID from the same bytes the SDK will hash internally. A hardcoded CID string would drift from the bytes and the test would either pass for the wrong reason (no integrity check) or fail unpredictably (integrity check rejects the mismatch).

---

## See also

- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — user-visible error messages and fixes for each invariant
- [`examples/zktls-twitter/sdk/README.md`](../../examples/zktls-twitter/sdk/README.md) — package overview, install, full API reference
- [`.claude/rules/lessons.md`](../../.claude/rules/lessons.md) — recurring failure patterns including the four lessons that motivated these invariants
