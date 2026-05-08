/**
 * Interim ambient declarations for the subset of `multiformats` used by
 * `proof.ts` (CID parsing + sha-256 digest construction) and the unit-test
 * helpers in `proof.test.ts` (raw-codec CID assembly via `Digest.create`).
 *
 * Why this exists: the upstream package historically shipped types that did
 * not consistently resolve under our `tsconfig.cjs.json` + `moduleResolution`
 * combination, so we vendor a minimal surface here to keep the build green.
 *
 * Limitations:
 *   - Only the methods we actually call are typed; any new call site must
 *     extend this file in lockstep or import from the real package.
 *   - These declarations are structural, not nominal — runtime errors
 *     (unsupported codecs, invalid varints, etc.) are still produced by the
 *     real library. Do not rely on these types to catch semantic mistakes.
 *
 * Remove this file once `multiformats` types resolve cleanly under both
 * tsconfig variants.
 */
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
