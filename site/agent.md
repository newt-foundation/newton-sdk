# Newton integration

This guide is an updated, end-to-end "soup to nuts" walkthrough for:

- Writing a Newton Policy (WASM + Rego)
- Uploading policy files to IPFS via `newton-cli`
- Deploying a generic Newton Policy Wallet on Sepolia
- Building a Next.js application with the Newton SDK to interact with the policy

---

## Quick Start (Automated Deployment)

If you want to deploy everything with a single command, use the automated deployment scripts.

### Step 1: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|----------|-------------|
| `CHAIN_ID` | Target chain ID (11155111 for Sepolia) |
| `PINATA_JWT` | Your Pinata API JWT token |
| `PINATA_GATEWAY` | Your Pinata gateway URL |
| `PRIVATE_KEY` | Wallet private key (with 0x prefix) |
| `RPC_URL` | Sepolia RPC endpoint |
| `NEXT_PUBLIC_NEWTON_API_KEY` | Newton Protocol API key |
| `NEXT_PUBLIC_SEPOLIA_ALCHEMY_URL` | Alchemy HTTP RPC URL |
| `NEXT_PUBLIC_SEPOLIA_ALCHEMY_WS_URL` | Alchemy WebSocket RPC URL |

### Step 2: Deploy Everything

```bash
./deploy.sh
```

This single command:
1. Builds the WASM policy component
2. Uploads policy files to IPFS
3. Deploys policy to Newton network
4. Deploys Newton Policy Wallet to Sepolia
5. Sets the policy on the wallet
6. Configures the Next.js app with deployed addresses

### Step 3: Run the App

```bash
cd newton-sdk-app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Manual Deployment (Step-by-Step)

The sections below provide detailed manual deployment instructions. Use these if you need fine-grained control over each step, or if you're learning how Newton policies work.

---

## Environment Variables

Before starting, gather the following environment variables. You'll use them throughout this guide.

### Policy Deployment Variables

| Variable | Description | Developer Must Provide |
|----------|-------------|------------------------|
| `CHAIN_ID` | Target chain ID (11155111 for Sepolia) | Yes |
| `PINATA_JWT` | Pinata API JWT with write access | Yes |
| `PINATA_GATEWAY` | Your Pinata gateway URL | Yes |
| `PRIVATE_KEY` | Deployer wallet private key | Yes |
| `RPC_URL` | Sepolia RPC endpoint URL | Yes |

### SDK Integration Variables

| Variable | Description | Developer Must Provide |
|----------|-------------|------------------------|
| `NEXT_PUBLIC_SEPOLIA_ALCHEMY_URL` | Alchemy HTTP RPC URL | Yes |
| `NEXT_PUBLIC_SEPOLIA_ALCHEMY_WS_URL` | Alchemy WebSocket RPC URL | Yes |
| `DEVELOPER_PRIVATE_KEY` | Same private key used for wallet deployment | No (reuse from Step 4) |
| `NEXT_PUBLIC_NEWTON_API_KEY` | Newton Protocol API key | Yes |
| `NEXT_PUBLIC_POLICY_WALLET_ADDRESS` | Deployed wallet address | No (from Step 4 output) |

---

## 0. Prerequisites

### Tooling

You'll need:

- **Rust + Cargo** (for `newton-cli`)
- **Node.js + npm** (for `@bytecodealliance/jco` and Next.js)
- **Foundry** (for deploying the Solidity contracts)

On macOS, a straightforward setup is:

```bash
# Rust (includes cargo)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# restart shell

# Node + npm (this repo expects Node >= 18)
brew install node
# restart shell

# Foundry (forge/cast/anvil)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Install `newton-cli`

```bash
cargo install newton-cli@0.2.0
newton-cli --help
```

### Install `@bytecodealliance/jco`

The `jco` CLI provides the `componentize` subcommand for building WASM components from JavaScript.

You have two common options:

#### Option A (recommended for a one-off guide): install globally

```bash
npm install -g @bytecodealliance/jco @bytecodealliance/componentize-js
jco componentize --help
```

#### Option B: keep it local + run via `npx`

```bash
mkdir policy-workspace && cd policy-workspace
npm init -y
npm install --save-dev @bytecodealliance/jco @bytecodealliance/componentize-js
npx jco componentize --help
```

---

## 1. Write and build the policy WASM component

Create a working directory:

```bash
mkdir policy-workspace && cd policy-workspace
mkdir -p policy-files
```

### 1.1 Create `newton-provider.wit`

Create `newton-provider.wit`:

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

Create `policy.js` (example skeleton):

```js
export function run(/* wasm_args */) {
  /*const wasmArgs = JSON.parse(wasm_args);

  const response = httpFetch({
    url: `https://fetch-request-url?param=${wasmArgs.param}`,
    method: "GET",
    headers: [],
    body: null
  });

  const body = JSON.parse(
    new TextDecoder().decode(new Uint8Array(response.body))
  );*/

  return JSON.stringify({
    success: true
  });
}
```

### 1.3 Build `policy.wasm` using `jco componentize`

Build the component:

```bash
# if installed globally:
jco componentize -w newton-provider.wit -o policy.wasm policy.js -d stdio random clocks http fetch-event

# if using Option B (local dev dependency):
# npx jco componentize -w newton-provider.wit -o policy.wasm policy.js -d stdio random clocks http fetch-event
```

This produces `policy.wasm` in the current directory.

### 1.4 (Optional) Simulate the WASM with `newton-cli`

**Note:** The `CHAIN_ID` environment variable must be set (e.g. `export CHAIN_ID=11155111` for Sepolia).

```bash
export CHAIN_ID=11155111
newton-cli policy-data simulate --wasm-file policy.wasm --input-json ''
```

If your WASM expects inputs:

```bash
newton-cli policy-data simulate --wasm-file policy.wasm --input-json '{"param": "foo"}'
```

---

## 2. Write the policy Rego + metadata files

### 2.1 Create `policy.rego`

Create `policy.rego`:

```
package your_policy
default allow := false

is_success = data.data.success # Result of running the WASM component

allow if {
    is_success
}
```

If you're new to Rego, see the Open Policy Agent language docs: `https://www.openpolicyagent.org/docs/latest/policy-language/`

### 2.2 Create `params_schema.json`

This schema controls what policy parameters clients are allowed to set.

```json
{
  "type": "object",
  "description": "",
  "properties": {}
}
```

### 2.3 Create `policy_data_metadata.json`

```json
{
  "name": "Your Policy Wasm",
  "version": "0.0.1",
  "author": "",
  "link": "",
  "description": "What the WASM does"
}
```

### 2.4 Create `policy_metadata.json`

```json
{
  "name": "Your Policy",
  "version": "0.0.1",
  "author": "",
  "link": "",
  "description": "Your policy description here"
}
```

### 2.5 Put files into `policy-files/`

The `newton-cli policy-files generate-cids --directory policy-files` step expects your files under `policy-files/`.

Move/copy:

```bash
cp policy.wasm policy.rego params_schema.json policy_data_metadata.json policy_metadata.json policy-files/
```

Checkpoint: `policy-files/` should contain:

- `policy.wasm`
- `policy.rego`
- `params_schema.json`
- `policy_data_metadata.json`
- `policy_metadata.json`

---

## 3. Upload policy files to IPFS + deploy policy (via `newton-cli`)

### 3.1 Prepare IPFS pinning credentials

You'll need a Pinata JWT with write access (or equivalent pinning provider credentials).

- Pinata docs: `https://docs.pinata.cloud/`

### 3.2 Load env vars (policy deployment)

Create a file (example) named `.env.policy`:

```bash
CHAIN_ID=11155111
PINATA_JWT=your_pinata_jwt
PINATA_GATEWAY=your_pinata_gateway
PRIVATE_KEY=0xYourDeploymentPK
RPC_URL=https://your-sepolia-rpc-url
```

Load it into your shell:

```bash
set -a
source .env.policy
set +a
```

### 3.3 Generate CIDs for `policy-files/`

```bash
newton-cli policy-files generate-cids \
  --directory policy-files \
  --output policy_cids.json \
  --entrypoint "your_policy.allow"
```

Note: the entrypoint must match your Rego package + rule name (e.g. `package your_policy` + `allow`).

### 3.4 Deploy the Policy Data (WASM)

```bash
newton-cli policy-data deploy --policy-cids policy_cids.json
```

Save the output address:

```
Policy data deployed successfully at address: 0xPolicy_Data_Address
```

### 3.5 Deploy the Policy (points at Policy Data)

```bash
newton-cli policy deploy \
  --policy-cids policy_cids.json \
  --policy-data-address "0xPolicy_Data_Address"
```

Save the Policy address; you'll use it when deploying the Newton Policy Wallet next.

---

## 4. Deploy the Newton Policy Wallet (Sepolia)

This step deploys a generic smart contract wallet that requires Newton attestations before executing transactions.

### 4.1 Create the wallet contract directory

```bash
mkdir newton-policy-wallet && cd newton-policy-wallet
forge init --no-git
```

### 4.2 Create the Solidity contract

First, initialize git (required by `forge install`) and install the newton-contracts dependency:

```bash
git init
forge install newt-foundation/newton-contracts
```

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

    constructor() {}

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        // Support INewtonPolicyClient interface (expected by Newton Policy contract)
        // 0xdbdcaa9c is the interface ID expected by the deployed Policy contract
        return interfaceId == 0xdbdcaa9c || super.supportsInterface(interfaceId);
    }

    function initialize(
        address policyTaskManager,
        address policy,
        address owner
    ) external {
        _initNewtonPolicyClient(policyTaskManager, policy, owner);
    }

    // setPolicy is inherited from NewtonPolicyClient - no need to redefine!
    // Just call: wallet.setPolicy(INewtonPolicy.PolicyConfig({policyParams: "{}", expireAfter: 31536000}))

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

**Important:** Update `foundry.toml` to enable `via_ir` compilation (required for newton-contracts due to stack depth):

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
    "forge-std/=lib/forge-std/src/"
]

fs_permissions = [{ access = "read", path = "./policy_params.json" }]

[rpc_endpoints]
sepolia = "${RPC_URL}"
```

**Key differences from a manual implementation:**
- Inherits from `NewtonPolicyClient` which handles policy registration with the Newton Policy contract
- Must override `supportsInterface` to include `0xdbdcaa9c` (the interface ID expected by the deployed Newton Policy contract)
- Uses `initialize()` pattern instead of constructor args for proper policy client setup
- The `setPolicy` function is inherited - no custom wrapper needed
- Uses `_validateAttestationDirect()` for direct attestation verification (evaluates intent without waiting for on-chain task response confirmation)
- Imports `INewtonProverTaskManager` for `Task` and `TaskResponse` struct types used by the direct validation flow
- Requires `via_ir = true` in foundry.toml due to stack depth of newton-contracts

### 4.3 Create the deployment script

Create `script/Deploy.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {NewtonPolicyWallet} from "../src/NewtonPolicyWallet.sol";

contract DeployScript is Script {
    // Newton Task Manager on Sepolia (MUST match the SDK gateway's task manager)
    // BLS signatures are bound to this address - using the wrong one causes InvalidAttestation
    address constant NEWTON_TASK_MANAGER = 0xecb741F4875770f9A5F060cb30F6c9eb5966eD13;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address policy = vm.envAddress("POLICY");
        address owner = vm.addr(deployerPrivateKey);  // Derive from private key

        vm.startBroadcast(deployerPrivateKey);

        // Deploy the wallet
        NewtonPolicyWallet wallet = new NewtonPolicyWallet();

        // Initialize with Newton Policy system
        wallet.initialize(NEWTON_TASK_MANAGER, policy, owner);

        console.log("NewtonPolicyWallet deployed at:", address(wallet));
        console.log("Initialized with:");
        console.log("  - Task Manager:", NEWTON_TASK_MANAGER);
        console.log("  - Policy:", policy);
        console.log("  - Owner:", owner);

        vm.stopBroadcast();
    }
}
```

### 4.4 Create the set policy script

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
        uint32 expireAfter = uint32(vm.envUint("EXPIRE_AFTER"));

        // Read policy params from file (empty JSON object by default)
        string memory paramsJson = vm.readFile("policy_params.json");
        bytes memory policyParams = bytes(paramsJson);

        vm.startBroadcast(deployerPrivateKey);

        NewtonPolicyWallet wallet = NewtonPolicyWallet(payable(walletAddress));

        // Call the inherited setPolicy function with PolicyConfig struct
        bytes32 newPolicyId = wallet.setPolicy(
            INewtonPolicy.PolicyConfig({
                policyParams: policyParams,
                expireAfter: expireAfter
            })
        );

        console.log("Policy set with ID:");
        console.logBytes32(newPolicyId);

        vm.stopBroadcast();
    }
}
```

### 4.5 Deploy the wallet

Create `.env` in the `newton-policy-wallet` directory:

```bash
PRIVATE_KEY=0xYourWalletDeployerPrivateKey
POLICY=<paste Policy address from Step 3.5>
RPC_URL=https://your-sepolia-rpc-url
```

Note: The wallet owner is automatically derived from the `PRIVATE_KEY`, so no separate `OWNER` variable is needed.

Deploy:

```bash
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url $RPC_URL --broadcast
```

Save the deployed wallet address - you'll use it in Step 5.

### 4.6 Set the policy on the wallet

Create `policy_params.json`:

```json
{}
```

Add to your `.env`:

```bash
WALLET_ADDRESS=0xYourWalletAddress
EXPIRE_AFTER=31536000
```

Run:

```bash
source .env
forge script script/SetPolicy.s.sol:SetPolicyScript --rpc-url $RPC_URL --broadcast
```

After this:
- Newton can generate attestations for your `NewtonPolicyWallet`
- The wallet will only execute transactions with valid attestations

---

## 5. Newton SDK Integration via Next.js App

Build a complete Next.js application to interact with your deployed Newton Policy Wallet.

### 5.1 Create the Next.js project

```bash
npx create-next-app@latest newton-sdk-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd newton-sdk-app
```

### 5.2 Install dependencies

```bash
npm install @magicnewton/newton-protocol-sdk viem
```

### 5.3 Set up environment variables

Create `.env.local`:

```bash
# Alchemy RPC URLs
NEXT_PUBLIC_SEPOLIA_ALCHEMY_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
NEXT_PUBLIC_SEPOLIA_ALCHEMY_WS_URL=wss://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Newton API key
NEXT_PUBLIC_NEWTON_API_KEY=your_newton_api_key

# Newton Policy Contract address (fixed on Sepolia)
# Note: This is the Newton Policy contract, NOT your wallet address
NEXT_PUBLIC_POLICY_CONTRACT_ADDRESS=0x698C687f86Bc2206AC7C06eA68AC513A2949abA6

# Wallet address from Step 4.5 deployment output
NEXT_PUBLIC_POLICY_WALLET_ADDRESS=<paste wallet address from Step 4.5>

# Signer private key for client-side signing (same as PRIVATE_KEY from Step 4)
NEXT_PUBLIC_SIGNER_PRIVATE_KEY=<same as PRIVATE_KEY from Step 4>
```

**Important clarifications:**
- `NEXT_PUBLIC_POLICY_CONTRACT_ADDRESS` is the Newton Policy contract (fixed address)
- `NEXT_PUBLIC_POLICY_WALLET_ADDRESS` is YOUR deployed wallet contract
- These are different! The Policy contract manages policy registration; your wallet is a client of it.

### 5.4 Create the configuration file

Create `src/const/config.ts`:

```typescript
import { Hex } from "viem";

// Environment variables
export const SEPOLIA_ALCHEMY_URL = process.env.NEXT_PUBLIC_SEPOLIA_ALCHEMY_URL!;
export const SEPOLIA_ALCHEMY_WS_URL = process.env.NEXT_PUBLIC_SEPOLIA_ALCHEMY_WS_URL!;
export const NEWTON_API_KEY = process.env.NEXT_PUBLIC_NEWTON_API_KEY!;
export const POLICY_WALLET_ADDRESS = process.env.NEXT_PUBLIC_POLICY_WALLET_ADDRESS as Hex;
export const POLICY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_POLICY_CONTRACT_ADDRESS as Hex;
export const SIGNER_PRIVATE_KEY = process.env.NEXT_PUBLIC_SIGNER_PRIVATE_KEY as Hex;
```

### 5.5 Create the ABI file

Create `src/lib/abi.ts`:

```typescript
export const newtonPolicyWalletAbi = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "initialize",
    inputs: [
      { name: "policyTaskManager", type: "address", internalType: "address" },
      { name: "policy", type: "address", internalType: "address" },
      { name: "owner", type: "address", internalType: "address" },
    ],
    outputs: [],
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
                  { name: "attestation", type: "bytes", internalType: "bytes" },
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
    type: "function",
    name: "setPolicy",
    inputs: [
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
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
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

Note: The ABI above is simplified. The full ABI from compilation will include additional functions inherited from `NewtonPolicyClient` like `policyClientOwner()`, `policyId()`, etc.

### 5.6 Create the evaluation request helper

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
  // Function signature for validateAndExecuteDirect
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

### 5.7 Create the transaction execution helper

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

  const txHash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx });

  return txHash;
};
```

### 5.8 Create the Newton client hook

Create `src/lib/use-newton-client.ts`:

```typescript
"use client";

import { useMemo } from "react";
import { createWalletClient, webSocket, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { newtonWalletClientActions } from "@magicnewton/newton-protocol-sdk";
import { SEPOLIA_ALCHEMY_WS_URL, NEWTON_API_KEY } from "@/const/config";

export const useNewtonClient = (privateKey: Hex) => {
  const client = useMemo(() => {
    const account = privateKeyToAccount(privateKey);

    // Initialize the wallet client with Newton SDK actions
    // The apiKey is required for SDK initialization
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: webSocket(SEPOLIA_ALCHEMY_WS_URL),
    }).extend(newtonWalletClientActions({ apiKey: NEWTON_API_KEY }));

    return {
      walletClient,
      account,
      signer: account,
    };
  }, [privateKey]);

  return client;
};
```

### 5.9 Create the main page

Replace `src/app/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Hex } from "viem";
import { createWalletClient, webSocket } from "viem";
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
  const [targetAddress, setTargetAddress] = useState<string>("0x31386C6a234AbF509579bDBA4854e9925fac1Ffa");
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
      // Create the wallet client with Newton SDK
      // Initialize with apiKey for SDK authentication
      const account = privateKeyToAccount(SIGNER_PRIVATE_KEY);
      const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: webSocket(SEPOLIA_ALCHEMY_WS_URL),
      }).extend(newtonWalletClientActions({ apiKey: NEWTON_API_KEY }));

      // Create the evaluation request
      const evalRequest = createEvaluationRequest({
        signerAddress: account.address,
        targetAddress: targetAddress as Hex,
        value: BigInt(value),
        data: data as Hex,
        wasmArgs: JSON.parse(wasmArgs),
      });

      // Evaluate intent directly (no on-chain task submission wait)
      const evalResponse = await walletClient.evaluateIntentDirect(evalRequest);
      const { evaluationResult: allowed, task, taskResponse: evalTaskResponse, blsSignature } = evalResponse.result;
      setTaskId(task.taskId);
      setEvaluationResult(allowed);

      if (!allowed) {
        setStatus("error");
        setError("Policy evaluation failed - transaction blocked");
        return;
      }

      // Execute the transaction with the direct attestation
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
          <p className="text-xs text-gray-500 mt-1">
            Arguments passed to your policy WASM component
          </p>
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

      {/* Status Display */}
      {status !== "idle" && (
        <div className="mt-8 space-y-4">
          {taskId && (
            <div className="p-4 bg-gray-100 rounded">
              <p className="text-sm font-medium">Task ID:</p>
              <code className="text-xs break-all">{taskId}</code>
            </div>
          )}

          {evaluationResult !== null && (
            <div
              className={`p-4 rounded ${
                evaluationResult ? "bg-green-100" : "bg-red-100"
              }`}
            >
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
              <p className="text-sm mt-2">
                <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  View on Etherscan: {txHash}
                </a>
              </p>
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

### 5.10 Update the layout

Ensure `src/app/layout.tsx` exists with basic setup:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Newton Policy Wallet Demo",
  description: "Execute transactions with Newton Policy attestations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

### 5.11 Run the application

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 6. Verification Steps

Verify your complete setup works end-to-end:

### 6.1 Run the Next.js app locally

```bash
cd newton-sdk-app
npm run dev
```

### 6.2 Submit an evaluation request through the UI

1. Enter a valid private key with some Sepolia ETH for gas
2. Enter a target address (can be any valid address for testing)
3. Set value to `0` (or a small amount if sending ETH)
4. Set data to `0x` (or encoded function call data)
5. Configure WASM args based on your policy requirements
6. Click "Submit Transaction"

### 6.3 Observe the flow

1. **Task ID appears**: The Newton network has received your evaluation request
2. **Evaluation Result**: Shows "Allowed" or "Blocked" based on your policy logic
3. **If Allowed**: Transaction is signed and submitted with the attestation
4. **Transaction Hash**: Link to view on Sepolia Etherscan

### 6.4 Verify on Sepolia Etherscan

1. Click the Etherscan link in the success message
2. Verify the transaction was sent to your Newton Policy Wallet
3. Check the `Executed` event in the transaction logs
4. Confirm the `taskId` in the event matches your evaluation request

### 6.5 Test policy rejection

1. Modify your WASM args to trigger a policy failure
2. Submit the transaction
3. Verify the evaluation returns "Blocked"
4. Confirm no transaction is submitted to the chain

---

## 7. Create Project README

After completing your deployment, create a `README.md` file in your project root to document your Newton Policy Wallet demo for future reference and collaboration.

### 7.1 Create `README.md`

Create a `README.md` file in your project root with the following template:

```markdown
# Newton Policy Wallet Demo

## Overview

This repository contains a complete Newton Policy Wallet integration demo with three main components:

1. **WASM Policy** (`policy-workspace/`): A WebAssembly policy component that defines custom transaction validation logic using JavaScript/Rego
2. **Solidity Wallet** (`newton-policy-wallet/`): A smart contract wallet deployed on Sepolia that enforces Newton attestations before executing transactions
3. **Next.js Frontend** (`newton-sdk-app/`): A web application that demonstrates how to submit transactions through the Newton Policy Wallet using the Newton SDK

The demo showcases how to build policy-gated smart contract wallets where transactions are only executed after passing through Newton's decentralized policy evaluation network.

## Quickstart

### Prerequisites

- Node.js >= 18
- A Sepolia RPC URL (e.g., from Alchemy)
- A wallet with Sepolia ETH for gas
- A Newton API key

### Running the Demo

1. Navigate to the Next.js app directory:

   ```bash
   cd newton-sdk-app
   ```

2. Configure environment variables by creating `.env.local`:

   ```bash
   # Alchemy RPC URLs
   NEXT_PUBLIC_SEPOLIA_ALCHEMY_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
   NEXT_PUBLIC_SEPOLIA_ALCHEMY_WS_URL=wss://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

   # Same private key used for wallet deployment
   DEVELOPER_PRIVATE_KEY=<same as PRIVATE_KEY from wallet deployment>

   # Newton API key
   NEXT_PUBLIC_NEWTON_API_KEY=your_newton_api_key

   # Wallet address from deployment output
   NEXT_PUBLIC_POLICY_WALLET_ADDRESS=<paste wallet address from deployment>
   ```

3. Install dependencies and start the development server:

   ```bash
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

5. Enter your private key, target address, and transaction parameters, then click "Submit Transaction" to test the policy evaluation flow

## Customizing Your Policy

To modify the policy logic and redeploy:

### 1. Update the Policy Logic

Edit `policy-workspace/policy.js` to change your WASM policy logic:

```js
export function run(wasm_args) {
  const args = JSON.parse(wasm_args);

  // Add your custom validation logic here
  const isValid = /* your validation */;

  return JSON.stringify({
    success: isValid
  });
}
```

Optionally update `policy-workspace/policy.rego` for additional Rego-based rules:

```rego
package your_policy
default allow := false

allow if {
    data.data.success
    # Add additional conditions here
}
```

### 2. Rebuild the WASM Component

```bash
cd policy-workspace
jco componentize -w newton-provider.wit -o policy.wasm policy.js -d stdio random clocks http fetch-event
cp policy.wasm policy-files/
```

### 3. Redeploy the Policy

```bash
# Load your deployment environment
source .env.policy

# Generate new CIDs
newton-cli policy-files generate-cids \
  --directory policy-files \
  --output policy_cids.json \
  --entrypoint "your_policy.allow"

# Deploy the updated policy data
newton-cli policy-data deploy --policy-cids policy_cids.json

# Deploy the updated policy (use the new policy data address)
newton-cli policy deploy \
  --policy-cids policy_cids.json \
  --policy-data-address "0xNewPolicyDataAddress"
```

### 4. Update the Wallet (if needed)

If the policy address changed, update your Newton Policy Wallet to point to the new policy, or deploy a new wallet with the updated policy address.
```

### 7.2 Customize the README

Update the README template with:

- Your specific policy logic description
- Any additional environment variables your policy requires
- Custom WASM arguments your policy expects
- Links to your deployed contracts on Sepolia Etherscan

---

## Appendix: Common pitfalls

### "command not found" after installing tools

Restart your shell after installing `rustup`, Homebrew Node, or Foundry, or re-source your shell config (e.g. `source ~/.zshrc`).

### `jco componentize` installed locally but command fails

If you did `npm install @bytecodealliance/jco` without `-g`, run it via `npx jco componentize ...` instead of `jco componentize ...`. Note: you also need `@bytecodealliance/componentize-js` as a peer dependency.

### WebSocket connection fails

Ensure your `NEXT_PUBLIC_SEPOLIA_ALCHEMY_WS_URL` uses the `wss://` protocol, not `https://`. The Newton SDK uses a WebSocket connection for the wallet client transport.

### "Invalid attestation" error on execution (`0xbd8ba84d`)

This usually means:
- **Wrong task manager address** (most common): The wallet was initialized with a different task manager than the one the Newton SDK gateway signs against. The wallet MUST use `0xecb741F4875770f9A5F060cb30F6c9eb5966eD13` on Sepolia. BLS signatures are bound to the specific task manager address — using any other address will always fail.
- The intent parameters don't match exactly (to, value, data, chainId)
- The policyId doesn't match the wallet's configured policy
- The task or taskResponse structs were not passed correctly from the `evaluateIntentDirect` result

### "ExecutionFailed" error on execution (`0xacfdb444`)

This means the attestation **passed** but the inner `to.call{value: value}(data)` reverted. Common causes:
- **Wallet contract has no ETH**: If you're sending value > 0, the wallet contract itself needs ETH (not just the signer EOA). Fund the wallet contract address directly.
- The target contract reverted (check the target's logic)
- The calldata is malformed for the target function

**Tip:** You can decode the revert reason with `cast`:
```bash
cast call <WALLET_ADDRESS> "0x<calldata>" --from <SIGNER> --rpc-url <RPC_URL>
```
Then match the error selector: `cast sig "ExecutionFailed()"` → `0xacfdb444`, `cast sig "InvalidAttestation()"` → `0xbd8ba84d`.

### Environment variables not loading

For Next.js:
- Client-side variables must be prefixed with `NEXT_PUBLIC_`
- Server-side only variables should NOT have this prefix
- Restart the dev server after modifying `.env.local`

### Gas estimation fails

The gas estimation step (`estimateGas`) simulates the transaction on-chain. If it reverts, the error message from viem is often unhelpful ("execution reverted for an unknown reason"). To debug:

1. Extract the calldata from the error message
2. Run `cast call <wallet> "0x<calldata>" --from <signer> --rpc-url <rpc>` to get the revert selector
3. Match the selector: `0xacfdb444` = `ExecutionFailed()`, `0xbd8ba84d` = `InvalidAttestation()`

Common causes:
- The signer doesn't have sufficient Sepolia ETH for gas
- The wallet contract has no ETH but value > 0 is being sent (fund the wallet contract, not just the signer)
- Wrong task manager address (see "Invalid attestation" above)
- The attestation has expired

### Policy evaluation times out

- Check that your policy WASM builds correctly
- Verify the `wasmArgs` are in the expected format
- Increase the `timeout` value in the evaluation request if needed
- Ensure your policy's external API calls (if any) are responding

### Foundry deployment fails

- Verify `PRIVATE_KEY` is prefixed with `0x`
- Ensure the deployer has sufficient Sepolia ETH
- Check `RPC_URL` is valid and accessible
- Run `forge build` first to catch compilation errors
- If `forge init --no-commit` fails, use `forge init --no-git` instead (flag varies by Foundry version)
- `forge install` requires a git repository — run `git init` first if you used `--no-git`
- Compilation requires `via_ir = true` in `foundry.toml` due to newton-contracts stack depth
