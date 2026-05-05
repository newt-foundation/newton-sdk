import type { AttesterSession, CreateTaskResponse, NewtonSDK, TaskIntent } from "@newton-protocol/zktls-twitter-example";

export type CheckStatus = "checking" | "success" | "error" | "idle";
export type ConsoleEntryType = "info" | "success" | "error" | "warning";

export interface ConsoleEntry {
  id: string;
  timestamp: string;
  message: string;
  type: ConsoleEntryType;
}

export interface SystemCheckResult {
  status: CheckStatus;
  message: string;
}

export interface SystemChecks {
  browser: SystemCheckResult;
  extension: SystemCheckResult;
  gateway: SystemCheckResult;
  attester: SystemCheckResult;
}

export interface DemoConfig {
  gatewayUrl: string;
  sidecarUrl: string;
  apiKey?: string;
  policyClient: string;
  intentFrom: string;
  intentTo: string;
  chainId: string | number;
}

export interface ProofRequest {
  twitterUsername: string;
  minFollowers: number;
  attesterUrl: string;
}

export interface ProofGenerationResult {
  cid: string;
  url?: string;
  proofBase64: string;
  followerCount: number;
  twitterUsername: string;
  sessionId: string;
  serverName?: string;
  verifierUrl: string;
  proxyUrl: string;
}

export interface TwitterTaskSubmission {
  policyClient: string;
  from: string;
  to: string;
  proofCid: string;
  minFollowers: number;
  twitterUsername: string;
  chainId: string | number;
}

export interface TaskFormState {
  twitterUsername: string;
  minFollowers: number;
  policyClient: string;
  from: string;
  to: string;
  chainId: string | number;
  value: string | number | bigint;
  data: string;
  functionSignature: string;
  timeout: string | number;
}

export interface TaskPreview {
  policyClient: string;
  intent: TaskIntent;
  wasmArgs: string;
  wasmArgsJson: {
    min_followers: number;
    twitter_username: string;
    base_symbol: string;
    quote_symbol: string;
    feed_id: string;
  };
  timeout: number;
  useTwoPhase: boolean;
  proofCid?: string;
}

export type TaskSubmission = CreateTaskResponse;

export interface ProofArtifact {
  cid: string;
  url?: string;
  proof?: string;
  source: "extension" | "manual-cid";
  server?: string;
  twitterUsername: string;
  followerCount?: number;
  connectionTime?: number;
  generatedAt: string;
  session?: AttesterSession;
  rawResult?: unknown;
}

export interface PolicyDecision {
  status: "allow" | "deny" | "pending";
  source: "gateway" | "local-preview" | "not-available";
  followersCount?: number;
  minRequired: number;
  server?: string;
  proofAgeSecs?: number;
  checks: {
    tlsn_proof_valid: boolean | "unknown";
    correct_server: boolean | "unknown";
    proof_is_fresh: boolean | "unknown";
    meets_follower_threshold: boolean | "unknown";
  };
  reasons: string[];
}

export interface CheckDetails {
  tlsn_proof_valid?: boolean;
  correct_server?: boolean;
  proof_is_fresh?: boolean;
  meets_follower_threshold?: boolean;
  [key: string]: boolean | undefined;
}

export interface PolicyVisualization {
  allow: boolean;
  followersCount: number;
  threshold: number;
  server?: string;
  proofAgeSecs?: number;
  checks: CheckDetails;
  raw: unknown;
}

export interface DemoServices {
  createSdk(config: DemoConfig): NewtonSDK;
  checkSystem(config: DemoConfig): Promise<SystemChecks>;
  generateProof(sdk: NewtonSDK, request: ProofRequest): Promise<ProofGenerationResult>;
  submitTask(sdk: NewtonSDK, submission: TwitterTaskSubmission): Promise<CreateTaskResponse>;
}

declare global {
  interface Window {
    tlsn?: {
      execCode(code: string): Promise<string>;
    };
  }
}
