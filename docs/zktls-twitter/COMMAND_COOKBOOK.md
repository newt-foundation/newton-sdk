# zkTLS Twitter/X Command Cookbook

Copy-paste commands for common tutorial tasks.

Summary: this cookbook collects the most common commands. Replace placeholder values as needed before running them.

## Validate tutorial files

```bash
./scripts/zktls-tutorial-doctor.sh
```

With Docker Compose validation:

```bash
./scripts/zktls-tutorial-doctor.sh --docker
```

## Generate payload JSON

```bash
scripts/zktls-twitter-sdk-demo.sh \
  --policy-client 0x1111111111111111111111111111111111111111 \
  --from 0x2222222222222222222222222222222222222222 \
  --to 0x3333333333333333333333333333333333333333 \
  --proof-cid bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi \
  --chain-id 31337 \
  > /tmp/newton-zktls-twitter-payload.json
```

## Pretty-print generated payload

```bash
python3 -m json.tool /tmp/newton-zktls-twitter-payload.json
```

## Decode `wasm_args`

```bash
python3 - <<'PY'
import binascii, json
payload = json.load(open('/tmp/newton-zktls-twitter-payload.json'))
raw = payload['params'][0]['wasm_args'].removeprefix('0x')
print(json.dumps(json.loads(binascii.unhexlify(raw)), indent=2))
PY
```

## Submit generated payload to local gateway

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

## Submit an already-generated JSON file

```bash
curl -sS -X POST http://127.0.0.1:8080/rpc \
  -H 'Content-Type: application/json' \
  -H "x-newton-secret: $NEWTON_API_KEY" \
  --data-binary @/tmp/newton-zktls-twitter-payload.json \
  | python3 -m json.tool
```

## Prepare local Docker Compose env

```bash
cp -n bin/deploy/.env.local.example bin/deploy/.env.local
```

## Start local Docker Compose stack

```bash
docker compose \
  -f bin/deploy/docker-compose.gateway-local.yml \
  --env-file bin/deploy/.env.local \
  up --build
```

## Check gateway health

```bash
curl -fsS http://127.0.0.1:8080/health
```

## Tail gateway/operator logs

```bash
docker compose -f bin/deploy/docker-compose.gateway-local.yml logs -f gateway operator-1 operator-2
```

## Stop local stack

```bash
docker compose -f bin/deploy/docker-compose.gateway-local.yml down
```

## Clean local stack volumes

```bash
docker compose -f bin/deploy/docker-compose.gateway-local.yml down -v --remove-orphans
```

## Run focused tests

```bash
cargo test -p newton-cli commands::task::tests:: -- --nocapture
cargo test -p integration-tests --test tlsn_flow -- --nocapture
```


## Use extension demo for a real proof CID

```bash
git clone https://github.com/newt-foundation/newton-tlsn-extension-demo.git /tmp/newton-tlsn-extension-demo
cd /tmp/newton-tlsn-extension-demo
npm install
npm run build
```

Then follow that repo's extension loading instructions and copy the sidecar-returned CID into `scripts/zktls-twitter-sdk-demo.sh --proof-cid <CID>`.
