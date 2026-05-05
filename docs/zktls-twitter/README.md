# Newton zkTLS Twitter/X Tutorial Pack

This pack is for first-time external builders who want to understand and demo Newton's zkTLS flow for a Twitter/X follower-count policy.

All tutorial documents are English-only. Copy-pasteable commands are collected in `COMMAND_COOKBOOK.md`.

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

Summary: this tutorial helps a first-time developer quickly understand the Newton zkTLS request shape and local execution path. A real submission still requires a running gateway, API key, IPFS CID, and trusted TLSNotary key configuration.

## Identity integration roadmap

The current demo proves Twitter/X follower data, stores the proof on IPFS, and
passes the resulting CID as `proofCid`/`proof_cid` in the task request. The next
protocol milestone is to make TLS proofs optionally travel with encrypted
identity uploads so the gateway can verify the proof before persisting identity
data, removing the required IPFS hop for identity-backed zkTLS flows.

Follow-up work to track in Linear:

1. **Protocol follow-up** — extend `newt_uploadIdentityEncrypted` to accept an
   optional `tls_proof` field. The gateway should verify the proof signature,
   freshness, and server identity before storing the encrypted identity payload
   in Postgres.
2. **SDK follow-up** — update the main `@magicnewton/newton-protocol-sdk`
   `uploadIdentityEncrypted` wrapper to accept the optional proof, then add a
   convenience method that chains proof generation → identity upload → task
   submission.
3. **UX follow-up** — update the demo to show both paths: the standalone zkTLS
   proof-CID task flow documented here and the identity-integrated zkTLS flow
   once protocol support lands.

Until those tickets are linked, treat this section as the source checklist for
the protocol, SDK, and UX tracking items.

## Mintlify docs-site follow-up

- Keep the canonical tutorial pack in `docs/zktls-twitter/` for repo-local development and troubleshooting.
- Mirror the external-developer happy path in the Mintlify guide at `site/developers/guides/zktls-twitter.mdx`.
- Add the guide to the Developers → Guides navigation so reviewers can preview it from the docs sidebar.
- After the storage backend migrates from IPFS to gateway-owned Postgres, update both the repo tutorial and Mintlify guide together so CID/proof retrieval behavior stays consistent.

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
