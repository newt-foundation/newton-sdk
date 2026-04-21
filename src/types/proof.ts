export interface StoreProofRequest {
  /** Base64 BCS-serialized TLSNotary Presentation. */
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
