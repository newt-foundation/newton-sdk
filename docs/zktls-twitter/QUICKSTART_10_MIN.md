# 10-Minute zkTLS Twitter/X Quickstart

Goal: generate and inspect a valid Newton `newt_createTask` payload that carries a TLSNotary proof CID for a Twitter/X follower policy.

한국어 요약: 10분 안에 “실제 제출 전 요청 JSON이 어떻게 생겼는지” 확인하는 경로입니다. 로컬 게이트웨이나 Docker는 필요 없습니다.

## Prerequisites

- Git checkout of this repository
- Bash
- Python 3
- Optional: `jq` for easier inspection

No Docker stack is required for this quickstart.

## 1. Check tutorial fixtures

```bash
./scripts/zktls-tutorial-doctor.sh
```

Expected ending:

```text
✓ tutorial doctor passed
```

## 2. Generate a zkTLS Twitter task payload

```bash
scripts/zktls-twitter-sdk-demo.sh \
  --policy-client 0x1111111111111111111111111111111111111111 \
  --from 0x2222222222222222222222222222222222222222 \
  --to 0x3333333333333333333333333333333333333333 \
  --proof-cid bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi \
  | tee /tmp/newton-zktls-twitter-payload.json \
  | python3 -m json.tool
```

What to look for:

- `method` is `newt_createTask`
- `params[0].proof_cid` contains the TLSNotary proof CID
- `params[0].use_two_phase` is `true`
- `params[0].wasm_args` is a hex-encoded JSON object with `min_followers` and `twitter_username`

한국어 체크포인트: `proof_cid`가 IPFS CID이고, `wasm_args`는 정책 파라미터를 hex로 인코딩한 값입니다.

## 3. Compare SDK-style and raw JSON-RPC examples

```bash
python3 -m json.tool examples/zktls-twitter/configs/task.json
python3 -m json.tool examples/zktls-twitter/configs/create-task.json
```

- `task.json` is SDK/CLI-friendly camelCase (`proofCid`, `useTwoPhase`).
- `create-task.json` is raw gateway JSON-RPC snake_case (`proof_cid`, `use_two_phase`).

## 4. Understand the proof path

1. A client creates a TLSNotary presentation for `api.x.com` or `api.twitter.com`.
2. The presentation is stored on IPFS and returns a CID.
3. The SDK puts the CID in `proofCid` / `proof_cid`.
4. The gateway injects it into `_newton.proof_cid` for operator compatibility.
5. Operators fetch, verify, and expose verified fields to policy evaluation.


## Extension-demo handoff for real proofs

The dry-run payload above uses a placeholder CID. For a real external-user proof, use `newt-foundation/newton-tlsn-extension-demo` as the browser proof generator:

1. Load/build the extension demo.
2. Use its Newton plugin to open x.com and generate a TLSNotary proof.
3. Store the proof through the sidecar/verifier and copy the returned CID.
4. Re-run this quickstart with `--proof-cid <REAL_CID>` and `--twitter-username realsigridjin`.

한국어: 실제 증명은 브라우저 확장 프로그램에서 만들고, 이 저장소의 스크립트는 CID를 Newton Gateway 요청에 넣는 역할입니다.

## 5. Optional: run policy-only tests

If Rust dependencies are already available:

```bash
cargo test -p integration-tests --test tlsn_flow -- --nocapture
```

This validates the Twitter/X policy behavior with fixture data. It does not require a live Twitter/X request.

## Next step

When the payload shape is clear, continue to [LOCAL_DOCKER_COMPOSE.md](./LOCAL_DOCKER_COMPOSE.md) for the full local stack walkthrough.
