import { HexlifiedIntent, IntentFromParams, NormalizedIntent } from '@core/types/task';
import { Hex, hexToBigInt, toHex } from 'viem';

export const removeHexPrefix = (input: Hex): string => {
  return input.startsWith('0x') ? input.slice(2) : input;
};

export function normalizeIntent(intent: IntentFromParams): NormalizedIntent {
  let valueAsBigInt: bigint;
  if (typeof intent.value === 'bigint') {
    valueAsBigInt = intent.value;
  } else {
    valueAsBigInt = hexToBigInt(intent.value);
  }

  let chainIdAsBigInt: bigint;
  if (typeof intent.chainId === 'bigint') {
    chainIdAsBigInt = intent.chainId;
  } else if (typeof intent.chainId === 'number') {
    chainIdAsBigInt = BigInt(intent.chainId);
  } else {
    chainIdAsBigInt = hexToBigInt(intent.chainId);
  }

  return {
    ...intent,
    value: valueAsBigInt,
    chainId: chainIdAsBigInt,
  };
}

export function sanitizeIntentForRequest(intent: IntentFromParams): HexlifiedIntent {
  let valueAsHex: Hex;
  if (typeof intent.value === 'bigint') {
    valueAsHex = toHex(intent.value);
  } else {
    valueAsHex = intent.value;
  }

  let chainIdAsHex: Hex;
  if (typeof intent.chainId === 'bigint') {
    chainIdAsHex = toHex(intent.chainId);
  } else if (typeof intent.chainId === 'number') {
    chainIdAsHex = toHex(intent.chainId);
  } else {
    chainIdAsHex = intent.chainId;
  }
  return {
    from: intent.from,
    to: intent.to,
    value: valueAsHex,
    data: intent.data,
    chain_id: chainIdAsHex,
    function_signature: intent.functionSignature,
  };
}
