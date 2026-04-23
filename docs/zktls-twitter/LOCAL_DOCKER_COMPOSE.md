# End-to-End Local Docker Compose Walkthrough

Goal: run the local Newton gateway/operator stack, then submit a zkTLS-shaped Twitter/X task payload to the local gateway.

한국어 요약: Docker Compose로 로컬 게이트웨이/오퍼레이터 스택을 띄우고, quickstart에서 만든 zkTLS 요청을 로컬 게이트웨이에 보내는 절차입니다.

> First build can take a long time. Budget 20-45 minutes on a fresh machine.

## Prerequisites

- Docker and Docker Compose v2 (`docker compose version`)
- Rust toolchain for optional focused tests
- Enough disk space for Rust and Docker build artifacts
- Ports available: `5432`, `6379`, `8080`, `8545`, `8546`, `9005`, `9006`

## 1. Create local env file and validate local files

```bash
cp -n bin/deploy/.env.local.example bin/deploy/.env.local
./scripts/zktls-tutorial-doctor.sh --docker
```

This checks required example files, shell syntax, JSON syntax, and Docker Compose config when Docker is available.

## Port preflight

If Docker fails with `port is already allocated`, identify the process before retrying:

```bash
for port in 5432 6379 8080 8545 8546 9005 9006; do
  ss -ltnp "sport = :$port" || true
done
```

## 2. Start local stack

Preferred direct Docker Compose v2 path:

```bash
docker compose \
  -f bin/deploy/docker-compose.gateway-local.yml \
  --env-file bin/deploy/.env.local \
  up --build
```

If you use `just gateway-avs-local`, note that the current Justfile calls the legacy `docker-compose` binary. Install a compatibility shim or use the direct `docker compose` command above.


Run in another terminal for logs:

```bash
docker compose -f bin/deploy/docker-compose.gateway-local.yml logs -f gateway operator-1 operator-2 setup
```

## 3. Wait for health

```bash
curl -fsS http://127.0.0.1:8080/health
```

Expected: HTTP 200. If this fails, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## 4. Generate a local submission payload

Replace addresses with deployed local policy-client and intent addresses when using a real local deployment. The placeholders below are valid JSON only.

```bash
scripts/zktls-twitter-sdk-demo.sh \
  --policy-client 0x1111111111111111111111111111111111111111 \
  --from 0x2222222222222222222222222222222222222222 \
  --to 0x3333333333333333333333333333333333333333 \
  --proof-cid bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi \
  --chain-id 31337 \
  > /tmp/newton-zktls-twitter-payload.json
```

## 5. Submit to local gateway

Most local stacks require the seeded API key from `bin/deploy/.env.local` or setup logs. Export it before submitting:

```bash
export NEWTON_API_KEY="replace-with-local-api-key"

scripts/zktls-twitter-sdk-demo.sh \
  --policy-client 0x1111111111111111111111111111111111111111 \
  --from 0x2222222222222222222222222222222222222222 \
  --to 0x3333333333333333333333333333333333333333 \
  --proof-cid bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi \
  --chain-id 31337 \
  --gateway-url http://127.0.0.1:8080/rpc \
  --api-key "$NEWTON_API_KEY" \
  --submit
```

Important: a live zkTLS success path also requires the proof CID to be fetchable from the configured IPFS gateway and verifiable with the operator's trusted TLSNotary key. Placeholder CIDs are useful for payload validation, not for a successful cryptographic task.

## 6. Observe result

Gateway logs:

```bash
docker compose -f bin/deploy/docker-compose.gateway-local.yml logs -f gateway
```

Operator logs:

```bash
docker compose -f bin/deploy/docker-compose.gateway-local.yml logs -f operator-1 operator-2
```

Look for:

- gateway accepts `newt_createTask`
- task contains `proof_cid`
- operator attempts TLS proof fetch/verify
- policy result or actionable TLS proof error

## 7. Stop stack

```bash
docker compose -f bin/deploy/docker-compose.gateway-local.yml down
```

Clean volumes when you need a fresh deployment:

```bash
docker compose -f bin/deploy/docker-compose.gateway-local.yml down -v --remove-orphans
```
