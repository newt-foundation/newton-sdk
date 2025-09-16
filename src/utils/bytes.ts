import { Hex, toHex } from 'viem';

export function normalizeBytes(input: Hex | Uint8Array): `0x${string}` {
  return typeof input === 'string' ? input : toHex(input);
}
