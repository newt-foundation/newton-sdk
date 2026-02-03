import { mainnet, sepolia, baseSepolia } from 'viem/chains';
import { Hex } from 'viem';

export const GATEWAY_API_URLS: Record<number, string> = {
  [sepolia.id]: 'https://gateway-avs.sepolia.newt.foundation/rpc',
  [mainnet.id]: 'https://gateway-avs.newt.foundation/rpc',
  [baseSepolia.id]: 'https://gateway-avs.base-sepolia.newt.foundation/rpc',
} as const;

export const GATEWAY_METHODS = {
  createTask: 'newt_createTask',
  sendTask: 'newt_sendTask',
};

export const NEWTON_PROVER_TASK_MANAGER: Record<number, Hex> = {
  [sepolia.id]: '0xe74053819edb2847da64a064fa3f271ec8b8adbb',
  [mainnet.id]: '0x2010dbaa5438801bdc3f08174a799fe344f544ee',
  [baseSepolia.id]: '0x', //TODO: replace with prod addresses
};

export const ATTESTATION_VALIDATOR: Record<number, Hex> = {
  [sepolia.id]: '0xf919f378415b3b64c89c4caf61d01e389bec9bde',
  [mainnet.id]: '0x263c275c15867a4611a44c600e77144a23012a06',
  [baseSepolia.id]: '0x', //TODO: replace with prod addresses
};
