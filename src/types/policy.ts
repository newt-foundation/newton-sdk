import { Address, Hex } from './generic';

export type PolicyId = string;

export interface PolicyParamsJson {
  [k: string]: unknown;
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
  codeUri: string; // e.g., IPFS for Rego or other
}
