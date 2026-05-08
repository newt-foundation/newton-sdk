declare module "multiformats/cid" {
  export const CID: {
    parse(cid: string): { multihash: { bytes: Uint8Array; code: number } };
    createV1(
      codec: number,
      multihash: { bytes: Uint8Array; code?: number },
    ): { toString(): string };
  };
}

declare module "multiformats/hashes/sha2" {
  export const sha256: {
    code: number;
    digest(bytes: Uint8Array): Promise<{ bytes: Uint8Array; code: number }>;
  };
}

declare module "multiformats/hashes/digest" {
  export function create(
    code: number,
    digest: Uint8Array,
  ): { bytes: Uint8Array; code: number; size: number; digest: Uint8Array };
}
