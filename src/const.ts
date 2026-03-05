import { mainnet, sepolia, baseSepolia, base } from 'viem/chains';
import { Hex } from 'viem';

export const GATEWAY_API_URLS: Record<number, string> = {
  [sepolia.id]: 'https://gateway.testnet.newton.xyz/rpc',
  [mainnet.id]: 'https://gateway.newton.xyz/rpc',
  [baseSepolia.id]: 'https://gateway.testnet.newton.xyz/rpc',
  [base.id]: 'https://gateway.newton.xyz/rpc',
} as const;

export const GATEWAY_METHODS = {
  createTask: 'newt_createTask',
  sendTask: 'newt_sendTask',
  simulatePolicy: 'newt_simulatePolicy',
  simulateTask: 'newt_simulateTask',
  simulatePolicyData: 'newt_simulatePolicyData',
  simulatePolicyDataWithClient: 'newt_simulatePolicyDataWithClient',
};

export const NEWTON_PROVER_TASK_MANAGER: Record<number, Hex> = {
  [sepolia.id]: '0xecb741f4875770f9a5f060cb30f6c9eb5966ed13',
  [mainnet.id]: '0x2010dbaa5438801bdc3f08174a799fe344f544ee',
  [baseSepolia.id]: '0xc3dc89b5e5241ef53c468dfbaa371a7f1d465eb7',
};

export const ATTESTATION_VALIDATOR: Record<number, Hex> = {
  [sepolia.id]: '0x26f452e4b9c9c28508cb836ba486cceaa95b429c',
  [mainnet.id]: '0x263c275c15867a4611a44c600e77144a23012a06',
  [baseSepolia.id]: '0x4e21b596944ebe8bd3773dd70c6f134bd2840a73',
};
