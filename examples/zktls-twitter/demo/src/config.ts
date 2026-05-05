import type { DemoConfig } from "./types";

const DEFAULT_POLICY_CLIENT = "0x1111111111111111111111111111111111111111";
const DEFAULT_INTENT_FROM = "0x2222222222222222222222222222222222222222";
const DEFAULT_INTENT_TO = "0x3333333333333333333333333333333333333333";

export function getDemoConfig(): DemoConfig {
  return {
    sidecarUrl: import.meta.env.VITE_SIDECAR_URL ?? "http://localhost:7047",
    gatewayUrl: import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:8080",
    apiKey: import.meta.env.VITE_NEWTON_API_KEY || undefined,
    policyClient: import.meta.env.VITE_POLICY_CLIENT ?? DEFAULT_POLICY_CLIENT,
    intentFrom: import.meta.env.VITE_INTENT_FROM ?? DEFAULT_INTENT_FROM,
    intentTo: import.meta.env.VITE_INTENT_TO ?? DEFAULT_INTENT_TO,
  };
}
