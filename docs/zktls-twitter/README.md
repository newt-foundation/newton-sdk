# Newton zkTLS Twitter/X Tutorial Pack

This pack is for first-time external builders who want to understand and demo Newton's zkTLS flow for a Twitter/X follower-count policy.

한국어 안내: 각 문서는 영어를 기본으로 쓰되, 핵심 문장에는 짧은 한국어 설명을 함께 둡니다. 그대로 복사해서 실행할 수 있는 명령은 `COMMAND_COOKBOOK.md`에 모았습니다.

## Start here

| Goal | Document |
| --- | --- |
| 10-minute no-infra path | [QUICKSTART_10_MIN.md](./QUICKSTART_10_MIN.md) |
| Full local Docker Compose walkthrough | [LOCAL_DOCKER_COMPOSE.md](./LOCAL_DOCKER_COMPOSE.md) |
| Common failures and fixes | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |
| Copy-paste commands | [COMMAND_COOKBOOK.md](./COMMAND_COOKBOOK.md) |
| Minimal demo UX recommendations | [DEMO_UX_RECOMMENDATIONS.md](./DEMO_UX_RECOMMENDATIONS.md) |
| Extension-demo strategy and deltas | [EXTENSION_DEMO_STRATEGY.md](./EXTENSION_DEMO_STRATEGY.md) |
| Actual x.com/realsigridjin test report | [EXTERNAL_TEST_REPORT_XCOM_REALSIGRIDJIN.md](./EXTERNAL_TEST_REPORT_XCOM_REALSIGRIDJIN.md) |

## What this tutorial does

- Builds a zkTLS-backed `newt_createTask` request for Twitter/X follower verification.
- Reuses the example payloads in `examples/zktls-twitter/configs/`.
- References the operator-side Twitter policy from `newton-prover-avs`; this SDK repo carries only the client SDK/demo/tutorial assets.
- Shows where a real TLSNotary proof CID plugs into the gateway/operator path.
- Connects the CLI/demo payload path to the browser proof-generation UX in `newton-tlsn-extension-demo`.

## What this tutorial does not do

- It does not mint a production Twitter/X API token.
- It does not replace the TLSNotary browser/client prover UX.
- It does not bypass gateway, operator, IPFS, or trusted notary key requirements for a live submission.

한국어 요약: 이 튜토리얼은 “처음 보는 개발자”가 Newton zkTLS 요청 모양과 로컬 실행 경로를 빠르게 이해하도록 돕습니다. 실제 제출에는 실행 중인 게이트웨이, API 키, IPFS CID, 신뢰할 수 있는 TLSNotary 키 설정이 필요합니다.

## Repository map

```text
examples/zktls-twitter/configs/       # sample SDK and raw JSON-RPC payloads
scripts/zktls-twitter-sdk-demo.sh  # payload generator / optional submitter
scripts/zktls-tutorial-doctor.sh   # tutorial environment and fixture checker
bin/deploy/docker-compose.gateway-local.yml
```

## Validation commands used for this tutorial pack

```bash
cargo fmt --check
bash -n scripts/zktls-twitter-sdk-demo.sh
bash -n scripts/zktls-tutorial-doctor.sh
./scripts/zktls-tutorial-doctor.sh
scripts/zktls-twitter-sdk-demo.sh \
  --policy-client 0x1111111111111111111111111111111111111111 \
  --from 0x2222222222222222222222222222222222222222 \
  --to 0x3333333333333333333333333333333333333333 \
  --proof-cid bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi \
  | python3 -m json.tool >/tmp/newton-zktls-twitter-payload.json
```

## Publishing rollout plan

1. **Preview internally**: ask one SDK engineer and one non-core developer to follow the 10-minute quickstart without extra context.
2. **Publish docs**: link this pack from the public docs sidebar or README under “Tutorials → zkTLS Twitter/X”.
3. **Publish demo assets**: keep `examples/zktls-twitter/configs/`, `examples/zktls-twitter/sdk/`, `examples/zktls-twitter/demo/`, and `scripts/zktls-twitter-sdk-demo.sh` versioned together.
4. **Record a short walkthrough**: 3-5 minutes showing payload generation, local stack health checks, and the proof CID insertion point.
5. **Collect failure reports**: add any repeated external-user issue to `TROUBLESHOOTING.md` before expanding the tutorial surface.
