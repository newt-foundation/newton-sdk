import type { Hex } from 'viem'
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains'

export const GATEWAY_API_URLS: Record<number, string> = {
  [sepolia.id]: 'https://gateway.testnet.newton.xyz/rpc',
  [mainnet.id]: 'https://gateway.newton.xyz/rpc',
  [baseSepolia.id]: 'https://gateway.testnet.newton.xyz/rpc',
  [base.id]: 'https://gateway.newton.xyz/rpc',
} as const

export const GATEWAY_METHODS = {
  createTask: 'newt_createTask',
  sendTask: 'newt_sendTask',
  simulatePolicy: 'newt_simulatePolicy',
  simulateTask: 'newt_simulateTask',
  simulatePolicyData: 'newt_simulatePolicyData',
  simulatePolicyDataWithClient: 'newt_simulatePolicyDataWithClient',
  getPrivacyPublicKey: 'newt_getPrivacyPublicKey',
  getSecretsPublicKey: 'newt_getSecretsPublicKey',
  uploadIdentityEncrypted: 'newt_uploadIdentityEncrypted',
  getIdentityEncrypted: 'newt_getIdentityEncrypted',
  storeEncryptedSecrets: 'newt_storeEncryptedSecrets',
  uploadConfidentialData: 'newt_uploadConfidentialData',
  getConfidentialData: 'newt_getConfidentialData',
  registerWebhook: 'newt_registerWebhook',
  unregisterWebhook: 'newt_unregisterWebhook',
}

export const NEWTON_PROVER_TASK_MANAGER: Record<number, Hex> = {
  [sepolia.id]: '0xecb741f4875770f9a5f060cb30f6c9eb5966ed13',
  [mainnet.id]: '0x2010dbaa5438801bdc3f08174a799fe344f544ee',
  [baseSepolia.id]: '0xa5e104ad7f09df5d9036d1e9ad60fada11140071',
}

/** AttestationValidator contracts — verify BLS aggregate signatures on-chain. */
export const ATTESTATION_VALIDATOR: Record<number, Hex> = {
  [sepolia.id]: '0x26f452e4b9c9c28508cb836ba486cceaa95b429c',
  [mainnet.id]: '0x263c275c15867a4611a44c600e77144a23012a06',
  [baseSepolia.id]: '0xf345c77e111a5731f88571c7c69919e8460154e5',
}

/** IdentityRegistry contracts — on-chain identity data refs and policy client links. */
export const IDENTITY_REGISTRY: Record<number, Hex> = {
  [sepolia.id]: '0xbb688f4ad1bd896197db9a20e04abe8c6344625a',
  [baseSepolia.id]: '0x1b6ad56a68544e3f5d4afa29aa2aee8e62a70130',
}

/** PolicyClientRegistry contracts — on-chain policy client registration and lifecycle. */
export const POLICY_CLIENT_REGISTRY: Record<number, Hex> = {
  [sepolia.id]: '0x0dbd6e44a1814f5efe4f67a00b7f28642e3064dd',
  [baseSepolia.id]: '0x2a7b31e48e8b8962b71c36c9377e5a1023b89b0d',
}

/** ConfidentialDataRegistry contracts — on-chain provider-managed confidential data refs. */
export const CONFIDENTIAL_DATA_REGISTRY: Record<number, Hex> = {
  [sepolia.id]: '0xdaee51cda3c2728627b7432eacc09425be6a308b',
  [baseSepolia.id]: '0x64866c22ee0fb16b6b7502f5a4ca73d82f3de3d7',
}
