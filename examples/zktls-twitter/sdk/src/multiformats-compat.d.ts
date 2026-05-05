declare module "multiformats/cid" {
  export const CID: {
    parse(cid: string): { multihash: { bytes: Uint8Array } };
    createV1(codec: number, multihash: { bytes: Uint8Array }): { toString(): string };
  };
}

declare module "multiformats/hashes/sha2" {
  export const sha256: {
    digest(bytes: Uint8Array): Promise<{ bytes: Uint8Array }>;
  };
}
