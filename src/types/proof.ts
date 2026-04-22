export interface StoreProofRequest {
  proof: string;
}

export interface StoreProofResponse {
  cid: string;
  url: string;
}

export interface ProofClientStoreOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ProofClientRetrieveOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}
