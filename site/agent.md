# Newton Policy Creation Guide

This guide walks you through writing a Newton Policy (WASM oracle + Rego rules), simulating it locally, deploying it to the Newton network, deploying and configuring a Newton Policy Wallet smart contract, and building a Next.js frontend that submits evaluation requests via the Newton SDK.

**What this guide covers:**
- Writing a WASM data oracle component in JavaScript
- Writing and understanding Rego policy rules
- Simulating both the WASM oracle and the full policy locally before deploying
- Uploading policy files to IPFS and deploying via `newton-cli`
- Deploying a `NewtonPolicyWallet` smart contract on Sepolia
- Setting the policy on the deployed wallet
- Building a Next.js frontend using the Newton SDK

---

## Prerequisites

### Tooling

You'll need:

- **Rust + Cargo** (for `newton-cli`)
- **Node.js + npm** (for `@bytecodealliance/jco` and building the WASM component)
- **Foundry** (for deploying the Solidity contracts)

On macOS:

```bash
# Rust (includes cargo)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# restart shell

# Node + npm (Node >= 18 required)
brew install node
# restart shell

# Foundry (forge/cast/anvil)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Install `newton-cli`

```bash
curl -L cli.newton.xyz | sh
newtup
newton-cli --help
```

### Install `@bytecodealliance/jco` (pinned versions)

The `jco` CLI provides the `componentize` subcommand for building WASM components from JavaScript. **Always install locally with pinned versions** — do not install globally without pinning.

```bash
# In your policy directory
npm init -y
npm install --save-dev @bytecodealliance/jco@1.0.0 @bytecodealliance/componentize-js@0.4.1
```

> **Important:** Use `componentize-js@0.4.1` and `jco@1.0.0` specifically. Newer versions of `componentize-js` (0.9+) inject a `wasi:http/types@0.2.3` dependency that `newton-cli` does not support, causing `failed to instantiate wasm component` errors. Pin these versions locally in your policy directory rather than installing globally.

### Get a Newton API key

Go to [dashboard.newton.xyz](https://dashboard.newton.xyz/), sign in, and click **API Keys** in the left navigation — your key is already generated and ready to use.

---

## Environment Variables

Gather the following environment variables before starting. You'll use them throughout this guide.

### Policy Deployment Variables

| Variable | Description |
|----------|-------------|
| `CHAIN_ID` | Target chain ID (`11155111` for Sepolia) |
| `PINATA_JWT` | Pinata API JWT with write access |
| `PINATA_GATEWAY` | Your Pinata gateway URL |
| `PRIVATE_KEY` | Deployer wallet private key (with `0x` prefix) |
| `RPC_URL` | Sepolia RPC endpoint URL |

### SDK Integration Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SEPOLIA_ALCHEMY_URL` | Alchemy HTTP RPC URL |
| `NEXT_PUBLIC_SEPOLIA_ALCHEMY_WS_URL` | Alchemy WebSocket RPC URL |
| `NEXT_PUBLIC_NEWTON_API_KEY` | Newton Protocol API key |
| `NEXT_PUBLIC_POLICY_WALLET_ADDRESS` | Deployed wallet address (from Step 4 output) |

---

## Step 1 – Write and build the WASM policy component

Create a working directory:

```bash
mkdir policy-workspace && cd policy-workspace
mkdir -p policy-files
```

### 1.1 Create `newton-provider.wit`

The WIT (WebAssembly Interface Types) file defines the interface your WASM component implements. Create `newton-provider.wit`:

```
package newton:provider@0.1.0;

interface http {
    record http-request {
        url: string,
        method: string,
        headers: list<tuple<string, string>>,
        body: option<list<u8>>,
    }

    record http-response {
        status: u16,
        headers: list<tuple<string, string>>,
        body: list<u8>,
    }

    fetch: func(request: http-request) -> result<http-response, string>;
}

world newton-provider {
    import http;
    export run: func(input: string) -> result<string, string>;
}
```

### 1.2 Create `policy.js`

The WASM oracle is a JavaScript file that exports a `run` function. Its sole responsibility is **data retrieval** — fetch external data and return it as structured JSON. Do not encode policy decisions here; all allow/deny logic belongs in Rego. The return value becomes available in Rego as `data.data.*`.

Create `policy.js` (skeleton — replace the body with your actual data fetching logic):

```js
export function run(wasm_args) {
  const wasmArgs = JSON.parse(wasm_args);

  const response = httpFetch({
    url: `https://api.example.com/price?token=${wasmArgs.token_address}`,
    method: "GET",
    headers: [],
    body: null
  });

  const body = JSON.parse(
    new TextDecoder().decode(new Uint8Array(response.body))
  );

  // Return raw data only — no decisions, no boolean flags
  return JSON.stringify({
    price_usd: body.price_usd,
    last_updated: body.last_updated
  });
}
```

The `httpFetch` built-in is provided by the Newton WASM runtime (imported from the WIT interface). Return only the raw data fields your Rego rules need — keep the oracle free of any conditional logic.

### 1.3 Build `policy.wasm` using `jco componentize`

```bash
npx jco componentize -w newton-provider.wit -o policy.wasm policy.js -d stdio random clocks http fetch-event
```

This produces `policy.wasm` in the current directory.

---

## Step 2 – Write the Rego policy

The Rego policy is where all business logic lives. The WASM oracle only supplies raw data; Rego decides whether to allow or deny a transaction based on that data, policy parameters, and the transaction intent.

### 2.1 Understanding available attributes

In your Rego policy, you have access to three categories of data:

#### Policy parameters (`data.params.*`)

Parameters that the policy client (your wallet) sets when calling `setPolicy()`. These are encoded as JSON in the `policyParams` field of `PolicyConfig`. Use them to configure policy behavior per wallet (e.g., spending limits, whitelisted addresses).

```rego
# Access policy parameters set by the wallet owner
max_value := data.params.max_value_wei
allowed_recipients := data.params.allowed_recipients
```

#### WASM data output (`data.data.*`)

The JSON object returned by your WASM oracle's `run` function. Newton runs the WASM component before evaluating Rego, and the returned fields are available under `data.data`.

```rego
# Access data fetched by your WASM oracle
token_price := data.data.price_usd
last_updated := data.data.last_updated
```

#### Intent attributes (`input.*`)

The transaction intent submitted by the user. These fields describe the transaction that the wallet wants to execute:

| Field | Type | Description |
|-------|------|-------------|
| `input.from` | address | The signer/sender address |
| `input.to` | address | The target contract/address |
| `input.value` | uint256 | ETH value in wei |
| `input.decoded_function_arguments[0]` | any | First decoded argument of the target function call |
| `input.chain_id` | uint256 | Chain ID (e.g., 11155111 for Sepolia) |
| `input.function.name` | string | Name of the function being called on the target |

### 2.2 Rego syntax reference

Newton uses a subset of the Open Policy Agent (OPA) Rego language. This section covers the key constructs you'll use.

#### Module structure

Every policy file must start with a `package` declaration. The package name determines the entrypoint path.

```rego
package your_policy          # defines the namespace

import future.keywords       # enables modern keyword syntax (optional)
```

The entrypoint rule is typically `allow`. When you deploy, you specify it as `your_policy.allow`.

#### Rule types

**Value rules** — assign a computed value:

```rego
is_admin := input.from == "0xAdminAddress"
token_limit := data.params.max_tokens * 1000000
```

**Default rules** — provide a fallback when no other rule matches:

```rego
default allow := false      # deny by default (recommended)
default is_valid := false
```

**Conditional rules** — evaluate to true when all conditions in the body are met:

```rego
allow if {
    is_admin
    input.chain_id == 11155111
}
```

Multiple rule bodies for the same name are combined with OR:

```rego
allow if { is_admin }       # allow if admin
allow if { is_whitelisted } # OR if whitelisted
```

**Function rules** — reusable parameterized rules:

```rego
within_limit(amount, limit) if {
    amount <= limit
}
```

**Set comprehensions** — build a set from a collection:

```rego
allowed_set := {addr | addr := data.params.whitelist[_]}
```

**Object comprehensions** — build a key-value map:

```rego
addr_map := {addr: true | addr := data.params.whitelist[_]}
```

#### Key expressions

```rego
# Iteration
some i; item := array[i]

# Universal quantification
every addr in data.params.whitelist {
    addr != input.to
}

# Membership test
input.from in data.params.whitelist

# Negation
not is_blocked

# Walrus assignment
address := input.from
```

#### Supported built-in functions

| Function | Description |
|----------|-------------|
| `count(collection)` | Number of elements in array, set, or object |
| `sum(array)` | Sum of numeric array elements |
| `min(array)` | Minimum value in array |
| `array.slice(arr, start, stop)` | Slice of array from start to stop |
| `union(set_of_sets)` | Union of a set of sets |
| `object.keys(obj)` | Keys of an object as a set |
| `contains(str, substr)` | True if string contains substring |
| `ceil(number)` | Ceiling of a number |
| `time.parse_rfc3339_ns(str)` | Parse RFC3339 timestamp to nanoseconds |
| `regex.match(pattern, str)` | True if string matches regex pattern |
| `semver.is_valid(str)` | True if string is a valid semver |

#### Unsupported features

The following OPA features are **not supported** by Newton and must not be used:

- Cryptography functions (`crypto.*`)
- JWT functions (`io.jwt.*`)
- HTTP requests (`http.send`) — use the WASM oracle for external data instead
- Glob matching (`glob.*`)
- GraphQL (`graphql.*`)
- Any networking built-ins

### 2.3 Full example: token buy policy

This example shows all three attribute categories in action. It enforces:
- Admin bypass (owner can always transact)
- Recipient whitelist check
- Token price ceiling (from WASM oracle)
- Per-transaction value limit (from policy params)

```rego
package mock_erc20_policy

import future.keywords

default allow := false

# Admin always allowed
is_admin if {
    input.from == data.params.admin_address
}

# Check recipient is in the whitelist
is_whitelisted_recipient if {
    some addr in data.params.allowed_recipients
    addr == input.to
}

# Check token price from WASM oracle is below max
price_acceptable if {
    data.data.price_usd <= data.params.max_price_usd
}

# Check transaction value is within limit
value_within_limit if {
    input.value <= data.params.max_value_wei
}

# Admin bypass
allow if {
    is_admin
}

# Standard allow path: whitelist + price + value limit
allow if {
    is_whitelisted_recipient
    price_acceptable
    value_within_limit
    input.chain_id == 11155111
}
```

### 2.4 Create `policy.rego` for this guide

The WASM oracle returns raw data (e.g., a token price). Rego contains all the decision logic — the oracle should never return a boolean flag that the policy blindly trusts.

```rego
package your_policy

import future.keywords

default allow := false

# All conditions must hold for a transaction to be allowed

price_acceptable if {
    data.data.price_usd <= data.params.max_price_usd
}

value_within_limit if {
    input.value <= data.params.max_value_wei
}

recipient_allowed if {
    some addr in data.params.allowed_recipients
    addr == input.to
}

allow if {
    price_acceptable
    value_within_limit
    recipient_allowed
    input.chain_id == 11155111
}
```

Save this as `policy.rego` in `policy-workspace/`.

The matching `policy_params.json` for simulation:

```json
{
  "max_price_usd": 100,
  "max_value_wei": "1000000000000000000",
  "allowed_recipients": ["0xAddress1", "0xAddress2"]
}
```

### 2.5 Create metadata files

#### `params_schema.json`

Defines what policy parameters clients are allowed to set. Use an empty object for no parameters:

```json
{
  "type": "object",
  "description": "",
  "properties": {}
}
```

#### `policy_data_metadata.json`

```json
{
  "name": "Your Policy Wasm",
  "version": "0.0.1",
  "author": "",
  "link": "",
  "description": "What the WASM does"
}
```

#### `policy_metadata.json`

```json
{
  "name": "Your Policy",
  "version": "0.0.1",
  "author": "",
  "link": "",
  "description": "Your policy description here"
}
```

### 2.6 Organize files into `policy-files/`

The `newton-cli policy-files generate-cids` command expects all files under `policy-files/`:

```bash
cp policy.wasm policy.rego params_schema.json policy_data_metadata.json policy_metadata.json policy-files/
```

Checkpoint — `policy-files/` should contain:

- `policy.wasm`
- `policy.rego`
- `params_schema.json`
- `policy_data_metadata.json`
- `policy_metadata.json`

---

## Step 3 – Simulate the policy locally

Before deploying, simulate both the WASM oracle and the full policy (WASM + Rego) to confirm they behave as expected.

**Note:** The `CHAIN_ID` environment variable must be set before running any `newton-cli` simulation commands:

```bash
export CHAIN_ID=11155111
```

### 3.1 Simulate the WASM oracle alone (`policy-data simulate`)

Test that your WASM component runs and returns the expected raw data. This is where you verify the oracle is fetching the right fields before wiring them into Rego:

```bash
newton-cli policy-data simulate \
  --wasm-file policy.wasm \
  --input-json '{"token_address": "0xAbCd..."}'
```

Expected output (for the skeleton `policy.js`):

```json
{
  "price_usd": 42.50,
  "last_updated": "2024-01-15T10:00:00Z"
}
```

This output is what becomes `data.data.*` in your Rego rules. Verify the field names match exactly what your Rego policy references before moving on.

### 3.2 Simulate the full policy (`policy simulate`)

The full simulation runs the WASM oracle and then evaluates the Rego policy against a sample intent.

#### Create `intent.json`

```json
{
  "from": "0xYourSignerAddress",
  "to": "0xTargetContractAddress",
  "value": "0x0",
  "data": "0x",
  "chain_id": 11155111,
  "function": {
    "name": "transfer"
  },
  "decoded_function_arguments": []
}
```

#### Create `wasm_args.json`

```json
{
  "token_address": "0xAbCd..."
}
```

#### Create `policy_params.json`

```json
{
  "max_price_usd": 100,
  "max_value_wei": "1000000000000000000",
  "allowed_recipients": ["0xYourSignerAddress"]
}
```

#### Run the full simulation

```bash
newton-cli policy simulate \
  --wasm-file policy-files/policy.wasm \
  --rego-file policy-files/policy.rego \
  --intent-json intent.json \
  --entrypoint "your_policy.allow" \
  --wasm-args wasm_args.json \
  --policy-params-data policy_params.json
```

**Note on entrypoint:** Specify the entrypoint as `<package_name>.<rule_name>` (e.g., `your_policy.allow`). The `newton-cli` automatically adds the `data.` prefix internally — do not include it here.

### 3.3 Interpreting simulation output

A successful allow:

```json
{ "allow": true }
```

A blocked transaction:

```json
{ "allow": false }
```

Confirm your policy returns the expected result for your test cases before proceeding to deploy.

---

## Step 4 – Upload to IPFS and deploy

### 4.1 Load environment variables

Create a file named `.env.policy`:

```bash
CHAIN_ID=11155111
PINATA_JWT=your_pinata_jwt
PINATA_GATEWAY=your_pinata_gateway
PRIVATE_KEY=0xYourDeploymentPK
RPC_URL=https://your-sepolia-rpc-url
```

Load it into your shell:

```bash
set -a && source .env.policy && set +a
```

### 4.2 Generate CIDs for `policy-files/`

```bash
newton-cli policy-files generate-cids \
  --directory policy-files \
  --output policy_cids.json \
  --entrypoint "your_policy.allow"
```

The `--entrypoint` must match your Rego `package` name + rule name (e.g., `package your_policy` + `allow` → `your_policy.allow`).

### 4.3 Deploy the policy data (WASM)

```bash
newton-cli policy-data deploy --policy-cids policy_cids.json
```

Save the output address:

```
Policy data deployed successfully at address: 0xPolicy_Data_Address
```

### 4.4 Deploy the policy

```bash
newton-cli policy deploy \
  --policy-cids policy_cids.json \
  --policy-data-address "0xPolicy_Data_Address"
```

Save the Policy address — you'll use it in Step 5 when deploying the Newton Policy Wallet.

---

## Step 5 – Deploy the Newton Policy Wallet

This step deploys a smart contract wallet that requires Newton attestations before executing transactions.

### 5.1 Create the wallet contract directory

```bash
mkdir newton-policy-wallet && cd newton-policy-wallet
forge init --no-git
git init
forge install newt-foundation/newton-contracts
```

### 5.2 Create the Solidity contract

Create `src/NewtonPolicyWallet.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {NewtonPolicyClient} from "newton-contracts/src/mixins/NewtonPolicyClient.sol";
import {INewtonProverTaskManager} from "newton-contracts/src/interfaces/INewtonProverTaskManager.sol";

contract NewtonPolicyWallet is NewtonPolicyClient {
    event Executed(address indexed to, uint256 value, bytes data, bytes32 taskId);
    error InvalidAttestation();
    error ExecutionFailed();

    address public constant NEWTON_TASK_MANAGER = 0xecb741F4875770f9A5F060cb30F6c9eb5966eD13;

    constructor(address owner) {
        _initNewtonPolicyClient(NEWTON_TASK_MANAGER, owner);
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        // Support INewtonPolicyClient interface (expected by Newton Policy contract)
        // 0xdbdcaa9c is the interface ID expected by the deployed Policy contract
        return interfaceId == 0xdbdcaa9c || super.supportsInterface(interfaceId);
    }

    // setPolicy and setPolicyAddress are inherited from NewtonPolicyClient — do not redefine them

    function validateAndExecuteDirect(
        address to,
        uint256 value,
        bytes calldata data,
        INewtonProverTaskManager.Task calldata task,
        INewtonProverTaskManager.TaskResponse calldata taskResponse,
        bytes calldata signatureData
    ) external returns (bytes memory) {
        require(_validateAttestationDirect(task, taskResponse, signatureData), InvalidAttestation());

        (bool success, bytes memory result) = to.call{value: value}(data);
        if (!success) revert ExecutionFailed();

        emit Executed(to, value, data, task.taskId);
        return result;
    }

    receive() external payable {}
}
```

**Key implementation notes:**
- `NEWTON_TASK_MANAGER` is a constant in the contract — no need to pass it from deployment scripts
- `_initNewtonPolicyClient(taskManager, owner)` takes 2 params (task manager + owner) — policy address is set separately via `setPolicyAddress()`
- Uses constructor instead of a separate `initialize()` — no proxy/upgradeable pattern needed
- `setPolicyAddress` and `setPolicy` are both inherited from `NewtonPolicyClient` — do not redefine them
- Must override `supportsInterface` to include `0xdbdcaa9c` (required by the deployed Newton Policy contract)
- Uses `_validateAttestationDirect()` for direct attestation verification (no need to wait for aggregator)
- Requires `via_ir = true` in `foundry.toml` due to stack depth constraints in newton-contracts

Update `foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.27"
via_ir = true
optimizer = true
optimizer_runs = 200

remappings = [
    "newton-contracts/=lib/newton-contracts/",
    "forge-std/=lib/forge-std/src/",
    "@eigenlayer-middleware/=lib/newton-contracts/lib/eigenlayer-middleware/",
    "@openzeppelin/=lib/newton-contracts/lib/eigenlayer-middleware/lib/openzeppelin-contracts/",
    "@openzeppelin-upgrades/=lib/newton-contracts/lib/eigenlayer-middleware/lib/openzeppelin-contracts-upgradeable/",
    "@sp1-contracts/=lib/newton-contracts/lib/sp1-contracts/contracts/src/",
]

fs_permissions = [{ access = "read", path = "./policy_params.json" }]

[rpc_endpoints]
sepolia = "${RPC_URL}"
```

### 5.3 Create the deployment script

Create `script/Deploy.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {NewtonPolicyWallet} from "../src/NewtonPolicyWallet.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        NewtonPolicyWallet wallet = new NewtonPolicyWallet(owner);

        console.log("NewtonPolicyWallet deployed at:", address(wallet));
        console.log("Owner:", owner);

        vm.stopBroadcast();
    }
}
```

### 5.4 Create the set-policy script

Create `script/SetPolicy.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {NewtonPolicyWallet} from "../src/NewtonPolicyWallet.sol";
import {INewtonPolicy} from "newton-contracts/src/interfaces/INewtonPolicy.sol";

contract SetPolicyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address walletAddress = vm.envAddress("WALLET_ADDRESS");
        address policyAddress = vm.envAddress("POLICY_ADDRESS");
        uint32 expireAfter = uint32(vm.envOr("EXPIRE_AFTER", uint256(1 days)));

        NewtonPolicyWallet wallet = NewtonPolicyWallet(payable(walletAddress));

        vm.startBroadcast(deployerPrivateKey);

        // First set the policy contract address (with version compatibility check)
        wallet.setPolicyAddress(policyAddress);

        // Then set the policy config (params + expiration)
        bytes32 policyId = wallet.setPolicy(
            INewtonPolicy.PolicyConfig({
                policyParams: bytes("{}"),
                expireAfter: expireAfter
            })
        );

        console.log("Policy address set:", policyAddress);
        console.logBytes32(policyId);

        vm.stopBroadcast();
    }
}
```

### 5.5 Deploy the wallet

Create `.env` in the `newton-policy-wallet` directory:

```bash
PRIVATE_KEY=0xYourWalletDeployerPrivateKey
RPC_URL=https://your-sepolia-rpc-url
```

The wallet owner is automatically derived from `PRIVATE_KEY`. The Newton Task Manager address is hardcoded as a constant in the contract.

Deploy:

```bash
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url $RPC_URL --broadcast
```

Save the deployed wallet address from the output.

### 5.6 Set the policy on the wallet

Add to your `.env`:

```bash
WALLET_ADDRESS=0xYourWalletAddress
POLICY_ADDRESS=<paste Policy address from Step 4.4>
# EXPIRE_AFTER is optional — defaults to 1 day (86400 seconds)
```

Run:

```bash
source .env
forge script script/SetPolicy.s.sol:SetPolicyScript --rpc-url $RPC_URL --broadcast
```

After this completes:
- Newton can generate attestations for your `NewtonPolicyWallet`
- The wallet will only execute transactions that pass your Rego policy

### 5.7 Register the PolicyClient

Register your deployed wallet with the PolicyClientRegistry (required for identity linking):

```bash
newton-cli policy-client register \
  --registry 0x0dbd6e44a1814f5efe4f67a00b7f28642e3064dd \
  --client "0xYourWalletAddress" \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

Check registration status:

```bash
newton-cli policy-client status \
  --registry 0x0dbd6e44a1814f5efe4f67a00b7f28642e3064dd \
  --client "0xYourWalletAddress" \
  --rpc-url $RPC_URL
```

Contract addresses on Sepolia:

| Contract | Address |
|----------|---------|
| NewtonProverTaskManager | `0xecb741f4875770f9a5f060cb30f6c9eb5966ed13` |
| PolicyClientRegistry | `0x0dbd6e44a1814f5efe4f67a00b7f28642e3064dd` |
| AttestationValidator | `0x26f452e4b9c9c28508cb836ba486cceaa95b429c` |

---

## Step 6 – Newton SDK Integration via Next.js

Build a complete Next.js application to interact with your deployed Newton Policy Wallet.

### 6.1 Create the Next.js project

```bash
npx create-next-app@latest newton-sdk-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd newton-sdk-app
```

### 6.2 Install dependencies

```bash
npm install @magicnewton/newton-protocol-sdk@0.3.15 viem
```

### 6.3 Set up environment variables

Create `.env.local`:

```bash
# Alchemy RPC URLs
NEXT_PUBLIC_SEPOLIA_ALCHEMY_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
NEXT_PUBLIC_SEPOLIA_ALCHEMY_WS_URL=wss://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Newton API key (from dashboard.newton.xyz)
NEXT_PUBLIC_NEWTON_API_KEY=your_newton_api_key

# Wallet address from Step 5.5 deployment output
NEXT_PUBLIC_POLICY_WALLET_ADDRESS=<paste wallet address from Step 5.5>

# Signer private key for client-side signing
NEXT_PUBLIC_SIGNER_PRIVATE_KEY=<same as PRIVATE_KEY>
```

### 6.4 Create the configuration file

Create `src/const/config.ts`:

```typescript
import { Hex } from "viem";

export const SEPOLIA_ALCHEMY_URL = process.env.NEXT_PUBLIC_SEPOLIA_ALCHEMY_URL!;
export const SEPOLIA_ALCHEMY_WS_URL = process.env.NEXT_PUBLIC_SEPOLIA_ALCHEMY_WS_URL!;
export const NEWTON_API_KEY = process.env.NEXT_PUBLIC_NEWTON_API_KEY!;
export const POLICY_WALLET_ADDRESS = process.env.NEXT_PUBLIC_POLICY_WALLET_ADDRESS as Hex;
export const SIGNER_PRIVATE_KEY = process.env.NEXT_PUBLIC_SIGNER_PRIVATE_KEY as Hex;
```

### 6.5 Create the ABI file

Create `src/lib/abi.ts`:

```typescript
export const newtonPolicyWalletAbi = [
  {
    type: "constructor",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "validateAndExecuteDirect",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
      { name: "data", type: "bytes", internalType: "bytes" },
      {
        name: "task",
        type: "tuple",
        internalType: "struct INewtonProverTaskManager.Task",
        components: [
          { name: "taskId", type: "bytes32", internalType: "bytes32" },
          { name: "policyClient", type: "address", internalType: "address" },
          { name: "taskCreatedBlock", type: "uint32", internalType: "uint32" },
          { name: "quorumThresholdPercentage", type: "uint32", internalType: "uint32" },
          {
            name: "intent",
            type: "tuple",
            internalType: "struct NewtonMessage.Intent",
            components: [
              { name: "from", type: "address", internalType: "address" },
              { name: "to", type: "address", internalType: "address" },
              { name: "value", type: "uint256", internalType: "uint256" },
              { name: "data", type: "bytes", internalType: "bytes" },
              { name: "chainId", type: "uint256", internalType: "uint256" },
              { name: "functionSignature", type: "bytes", internalType: "bytes" },
            ],
          },
          { name: "intentSignature", type: "bytes", internalType: "bytes" },
          { name: "wasmArgs", type: "bytes", internalType: "bytes" },
          { name: "quorumNumbers", type: "bytes", internalType: "bytes" },
        ],
      },
      {
        name: "taskResponse",
        type: "tuple",
        internalType: "struct INewtonProverTaskManager.TaskResponse",
        components: [
          { name: "taskId", type: "bytes32", internalType: "bytes32" },
          { name: "policyClient", type: "address", internalType: "address" },
          { name: "policyId", type: "bytes32", internalType: "bytes32" },
          { name: "policyAddress", type: "address", internalType: "address" },
          {
            name: "intent",
            type: "tuple",
            internalType: "struct NewtonMessage.Intent",
            components: [
              { name: "from", type: "address", internalType: "address" },
              { name: "to", type: "address", internalType: "address" },
              { name: "value", type: "uint256", internalType: "uint256" },
              { name: "data", type: "bytes", internalType: "bytes" },
              { name: "chainId", type: "uint256", internalType: "uint256" },
              { name: "functionSignature", type: "bytes", internalType: "bytes" },
            ],
          },
          { name: "intentSignature", type: "bytes", internalType: "bytes" },
          { name: "evaluationResult", type: "bytes", internalType: "bytes" },
          {
            name: "policyTaskData",
            type: "tuple",
            internalType: "struct NewtonMessage.PolicyTaskData",
            components: [
              { name: "policyId", type: "bytes32", internalType: "bytes32" },
              { name: "policyAddress", type: "address", internalType: "address" },
              { name: "policy", type: "bytes", internalType: "bytes" },
              {
                name: "policyData",
                type: "tuple[]",
                internalType: "struct NewtonMessage.PolicyData[]",
                components: [
                  { name: "wasmArgs", type: "bytes", internalType: "bytes" },
                  { name: "data", type: "bytes", internalType: "bytes" },
                  { name: "policyDataAddress", type: "address", internalType: "address" },
                  { name: "expireBlock", type: "uint32", internalType: "uint32" },
                ],
              },
            ],
          },
          {
            name: "policyConfig",
            type: "tuple",
            internalType: "struct INewtonPolicy.PolicyConfig",
            components: [
              { name: "policyParams", type: "bytes", internalType: "bytes" },
              { name: "expireAfter", type: "uint32", internalType: "uint32" },
            ],
          },
        ],
      },
      { name: "signatureData", type: "bytes", internalType: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes", internalType: "bytes" }],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Executed",
    inputs: [
      { name: "to", type: "address", indexed: true, internalType: "address" },
      { name: "value", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "data", type: "bytes", indexed: false, internalType: "bytes" },
      { name: "taskId", type: "bytes32", indexed: false, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  { type: "error", name: "InvalidAttestation", inputs: [] },
  { type: "error", name: "ExecutionFailed", inputs: [] },
  { type: "receive", stateMutability: "payable" },
] as const;
```

### 6.6 Create the evaluation request helper

Create `src/lib/evaluation-request.ts`:

```typescript
import { Hex } from "viem";
import { sepolia } from "viem/chains";
import { POLICY_WALLET_ADDRESS } from "@/const/config";

function stringToHexBytes(str: string): Hex {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  return ("0x" + Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")) as Hex;
}

export type EvaluationRequestParams = {
  signerAddress: Hex;
  targetAddress: Hex;
  value: bigint;
  data: Hex;
  wasmArgs: Record<string, unknown>;
};

export const createEvaluationRequest = ({
  signerAddress,
  targetAddress,
  value,
  data,
  wasmArgs,
}: EvaluationRequestParams) => {
  const functionSignature = stringToHexBytes(
    "validateAndExecuteDirect(address,uint256,bytes,(bytes32,address,uint32,uint32,(address,address,uint256,bytes,uint256,bytes),bytes,bytes,bytes),(bytes32,address,bytes32,address,(address,address,uint256,bytes,uint256,bytes),bytes,bytes,(bytes32,address,bytes,(bytes,bytes,bytes,address,uint32)[]),(bytes,uint32)),bytes)"
  );

  return {
    policyClient: POLICY_WALLET_ADDRESS,
    intent: {
      from: signerAddress,
      to: targetAddress,
      value: `0x${value.toString(16)}` as Hex,
      data: data,
      chainId: sepolia.id,
      functionSignature: functionSignature,
    },
    wasmArgs: stringToHexBytes(JSON.stringify(wasmArgs)),
    timeout: 60,
  };
};
```

### 6.7 Create the transaction execution helper

Create `src/lib/execute-with-attestation.ts`:

```typescript
import { createPublicClient, encodeFunctionData, Hex, http } from "viem";
import { sepolia } from "viem/chains";
import { SEPOLIA_ALCHEMY_URL, POLICY_WALLET_ADDRESS } from "@/const/config";
import { newtonPolicyWalletAbi } from "./abi";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(SEPOLIA_ALCHEMY_URL),
});

export type ExecuteDirectParams = {
  to: Hex;
  value: bigint;
  data: Hex;
  task: any;
  taskResponse: any;
  signatureData: Hex;
  signerAddress: Hex;
  walletClient: {
    signTransaction: (tx: {
      to: Hex;
      data: Hex;
      nonce: number;
      gas: bigint;
      gasPrice: bigint;
    }) => Promise<Hex>;
  };
};

export const executeWithAttestationDirect = async ({
  to,
  value,
  data,
  task,
  taskResponse,
  signatureData,
  signerAddress,
  walletClient,
}: ExecuteDirectParams): Promise<Hex> => {
  const functionData = encodeFunctionData({
    abi: newtonPolicyWalletAbi,
    functionName: "validateAndExecuteDirect",
    args: [to, value, data, task, taskResponse, signatureData],
  });

  const [nonce, gas, baseGasPrice] = await Promise.all([
    publicClient.getTransactionCount({ address: signerAddress }),
    publicClient.estimateGas({
      to: POLICY_WALLET_ADDRESS,
      data: functionData,
      account: signerAddress,
    }),
    publicClient.getGasPrice(),
  ]);

  // Bump gas price by 20% to ensure replacement transactions are accepted
  const gasPrice = (baseGasPrice * BigInt(120)) / BigInt(100);

  const signedTx = await walletClient.signTransaction({
    to: POLICY_WALLET_ADDRESS,
    data: functionData,
    nonce,
    gas,
    gasPrice,
  });

  return publicClient.sendRawTransaction({ serializedTransaction: signedTx });
};
```

### 6.8 Create the main page

Replace `src/app/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Hex, createWalletClient, webSocket } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { newtonWalletClientActions } from "@magicnewton/newton-protocol-sdk";
import {
  SEPOLIA_ALCHEMY_WS_URL,
  NEWTON_API_KEY,
  POLICY_WALLET_ADDRESS,
  SIGNER_PRIVATE_KEY,
} from "@/const/config";
import { createEvaluationRequest } from "@/lib/evaluation-request";
import { executeWithAttestationDirect } from "@/lib/execute-with-attestation";

type Status = "idle" | "evaluating" | "executing" | "success" | "error";

export default function Home() {
  const [targetAddress, setTargetAddress] = useState<string>("");
  const [value, setValue] = useState<string>("0");
  const [data, setData] = useState<string>("0x");
  const [wasmArgs, setWasmArgs] = useState<string>("{}");
  const [status, setStatus] = useState<Status>("idle");
  const [taskId, setTaskId] = useState<string>("");
  const [evaluationResult, setEvaluationResult] = useState<boolean | null>(null);
  const [txHash, setTxHash] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("evaluating");
    setError("");
    setTaskId("");
    setEvaluationResult(null);
    setTxHash("");

    try {
      const account = privateKeyToAccount(SIGNER_PRIVATE_KEY);
      const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: webSocket(SEPOLIA_ALCHEMY_WS_URL),
      }).extend(newtonWalletClientActions({ apiKey: NEWTON_API_KEY }));

      const evalRequest = createEvaluationRequest({
        signerAddress: account.address,
        targetAddress: targetAddress as Hex,
        value: BigInt(value),
        data: data as Hex,
        wasmArgs: JSON.parse(wasmArgs),
      });

      const evalResponse = await walletClient.evaluateIntentDirect(evalRequest);
      const { evaluationResult: allowed, task, taskResponse: evalTaskResponse, blsSignature } = evalResponse.result;
      setTaskId(task.taskId);
      setEvaluationResult(allowed);

      if (!allowed) {
        setStatus("error");
        setError("Policy evaluation failed — transaction blocked");
        return;
      }

      setStatus("executing");
      const hash = await executeWithAttestationDirect({
        to: targetAddress as Hex,
        value: BigInt(value),
        data: data as Hex,
        task,
        taskResponse: evalTaskResponse,
        signatureData: blsSignature,
        signerAddress: account.address,
        walletClient,
      });

      setTxHash(hash);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Newton Policy Wallet Demo</h1>
      <p className="text-gray-600 mb-8">
        Execute transactions through your Newton Policy Wallet with attestation verification.
      </p>

      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <p className="text-sm">
          <strong>Policy Wallet:</strong>{" "}
          <code className="bg-gray-200 px-2 py-1 rounded">{POLICY_WALLET_ADDRESS}</code>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Target Address</label>
          <input
            type="text"
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value)}
            placeholder="0x..."
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Value (wei)</label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Data (hex)</label>
          <input
            type="text"
            value={data}
            onChange={(e) => setData(e.target.value)}
            placeholder="0x"
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">WASM Args (JSON)</label>
          <textarea
            value={wasmArgs}
            onChange={(e) => setWasmArgs(e.target.value)}
            placeholder="{}"
            className="w-full p-2 border rounded font-mono text-sm"
            rows={3}
          />
        </div>
        <button
          type="submit"
          disabled={status === "evaluating" || status === "executing"}
          className="w-full py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-400"
        >
          {status === "evaluating"
            ? "Evaluating Policy..."
            : status === "executing"
            ? "Executing Transaction..."
            : "Submit Transaction"}
        </button>
      </form>

      {status !== "idle" && (
        <div className="mt-8 space-y-4">
          {taskId && (
            <div className="p-4 bg-gray-100 rounded">
              <p className="text-sm font-medium">Task ID:</p>
              <code className="text-xs break-all">{taskId}</code>
            </div>
          )}
          {evaluationResult !== null && (
            <div className={`p-4 rounded ${evaluationResult ? "bg-green-100" : "bg-red-100"}`}>
              <p className="font-medium">
                Evaluation Result:{" "}
                <span className={evaluationResult ? "text-green-700" : "text-red-700"}>
                  {evaluationResult ? "Allowed" : "Blocked"}
                </span>
              </p>
            </div>
          )}
          {txHash && (
            <div className="p-4 bg-green-100 rounded">
              <p className="font-medium text-green-700">Transaction Successful!</p>
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all text-sm"
              >
                View on Etherscan: {txHash}
              </a>
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-100 rounded">
              <p className="font-medium text-red-700">Error</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
```

### 6.9 Run the application

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Step 7 – Verify end-to-end

1. Submit a transaction through the UI with target address, value, and WASM args
2. **Task ID appears** — Newton network received the evaluation request
3. **Evaluation Result** — shows "Allowed" or "Blocked" based on your policy
4. **If Allowed** — transaction is signed and submitted with the BLS attestation
5. **Transaction hash** — click the Etherscan link and verify the `Executed` event in logs

To test policy rejection, modify `wasmArgs` to return data that would cause a Rego condition to fail (e.g., a price above `max_price_usd`).

---

## Gateway URLs

| Network | Environment | URL |
|---------|-------------|-----|
| Testnet (Sepolia) | Production | `https://gateway.testnet.newton.xyz` |
| Testnet (Sepolia) | Staging | `https://gateway.stagef.testnet.newton.xyz` |
| Mainnet | Production | `https://gateway.newton.xyz` |
| Mainnet | Staging | `https://gateway.stagef.newton.xyz` |

Example curl against the production testnet gateway:

```bash
curl -X POST https://gateway.testnet.newton.xyz \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NEWTON_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "method": "newt_simulateTask",
    "params": {
      "policy_client": "0xYourPolicyClientAddress",
      "intent": {
        "from": "0xCallerAddress",
        "to": "0xTargetAddress",
        "value": "0x0",
        "data": "0x",
        "chain_id": "0xaa36a7",
        "function_signature": "0x"
      }
    },
    "id": 1
  }'
```

---

## Appendix: Common Pitfalls

### `jco componentize` version incompatibility

Use `@bytecodealliance/jco@1.0.0` and `@bytecodealliance/componentize-js@0.4.1` specifically. Newer `componentize-js` (0.9+) injects a `wasi:http/types@0.2.3` dependency that `newton-cli` does not support, producing `failed to instantiate wasm component` errors. Always pin locally:

```bash
npm install --save-dev @bytecodealliance/jco@1.0.0 @bytecodealliance/componentize-js@0.4.1
npx jco componentize ...
```

### Simulation failures

- Ensure `CHAIN_ID` is exported: `export CHAIN_ID=11155111`
- Verify field names in `data.data.*` match exactly what your WASM returns — run `policy-data simulate` first and inspect the output
- The `--entrypoint` flag should be `package_name.rule_name` (e.g., `your_policy.allow`) — do not include the `data.` prefix

### Foundry deployment issues

- Verify `PRIVATE_KEY` is prefixed with `0x`
- Ensure the deployer wallet has sufficient Sepolia ETH
- Check `RPC_URL` is valid and reachable
- Run `forge build` first to catch compilation errors before deploying
- If `forge init --no-commit` fails, use `forge init --no-git` instead (flag name varies by Foundry version)
- `forge install` requires a git repository — run `git init` first if you used `--no-git`
- Compilation requires `via_ir = true` in `foundry.toml` due to newton-contracts stack depth

### Invalid attestation on wrong task manager

The wallet MUST use `0xecb741F4875770f9A5F060cb30F6c9eb5966eD13` as the Newton Task Manager on Sepolia. BLS signatures are bound to this specific address — using any other address will always produce `InvalidAttestation` errors.

### Rego policy always returns `allow: false`

- Verify rule conditions use the correct attribute paths (`data.params.*`, `data.data.*`, `input.*`)
- Run `policy-data simulate` first and inspect the oracle output — confirm exact field names and value types
- Do not write decision logic in the oracle and check a boolean flag in Rego (e.g., `allow if { data.data.success }`) — all conditions belong in Rego
- Run `policy simulate` to test the full pipeline with your specific intent values
- Remember Rego uses `==` for equality checks, not `=`

### "ExecutionFailed" error (`0xacfdb444`)

The attestation passed but the inner `to.call{value: value}(data)` reverted. Common causes:
- **Wallet contract has no ETH** — if sending value > 0, fund the wallet contract address directly
- The target contract reverted — debug the target transaction independently
- Malformed calldata

### WebSocket connection fails

Ensure `NEXT_PUBLIC_SEPOLIA_ALCHEMY_WS_URL` uses the `wss://` protocol, not `https://`. The Newton SDK uses a WebSocket connection for the wallet client transport.

### "command not found" after installing tools

Restart your shell after installing `rustup`, Homebrew Node, or Foundry, or re-source your shell config (`source ~/.zshrc`).
