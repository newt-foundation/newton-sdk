import type { DemoConfig } from "./types";

const DEFAULT_POLICY_CLIENT = "0x67aD6EA566BA6B0fC52e97Bc25CE46120fdAc04c";
const DEFAULT_INTENT_FROM = "0x2222222222222222222222222222222222222222";
const DEFAULT_INTENT_TO = "0x3333333333333333333333333333333333333333";
const DEFAULT_CHAIN_ID = "31337";

export function getDemoConfig(): DemoConfig {
  return {
    sidecarUrl: import.meta.env.VITE_SIDECAR_URL ?? "http://localhost:7047",
    gatewayUrl: import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:8080",
    apiKey: import.meta.env.VITE_NEWTON_API_KEY || undefined,
    policyClient: import.meta.env.VITE_POLICY_CLIENT ?? DEFAULT_POLICY_CLIENT,
    intentFrom: import.meta.env.VITE_INTENT_FROM ?? import.meta.env.VITE_DEMO_FROM ?? DEFAULT_INTENT_FROM,
    intentTo: import.meta.env.VITE_INTENT_TO ?? import.meta.env.VITE_DEMO_TO ?? DEFAULT_INTENT_TO,
    chainId: import.meta.env.VITE_CHAIN_ID ?? DEFAULT_CHAIN_ID,
  };
}
