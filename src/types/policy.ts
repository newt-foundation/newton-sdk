import { Address, Hex } from 'viem';

export type PolicyId = string;

export interface PolicyParamsJson {
  admin: string;
  allowed_actions: {
    [chainId: string]: {
      address: string;
      function_name: string;
      max_limit: number;
    };
  };
  token_whitelist: {
    [chainId: string]: {
      address: string;
      max_limit: number;
      symbol: string;
    };
  };
} // developer-supplied
export interface SetPolicyInput {
  client: Address; // policy client (e.g., vault) address
  policyContract: Address; // deployed policy contract (code/metadata)
  policyDataRefs?: Address[]; // optional array of PolicyData contract refs
  params: PolicyParamsJson; // JSON object → encoded to bytes passed to setPolicy
}

export interface SetPolicyResult {
  ok: true;
  policyId: PolicyId;
  txHash: Hex;
}

export interface PolicyInfo {
  policyId: PolicyId;
  client: Address;
  policyContract: Address;
  policyDataRefs: Address[];
  paramsBytes: Hex; // canonical bytes as stored on-chain
  paramsJson?: PolicyParamsJson; // optional decode if schema known
}

type Bytes = Uint8Array | Buffer | `0x${string}`;

export interface PolicyDataInfo {
  wasmUri: string; // e.g., IPFS/HTTPS
  argsSchemaBytes?: Bytes; // WASM args (if any)
}

export interface PolicyCodeInfo {
  codeUri: string; // e.g., IPFS for Rego or other.
}
