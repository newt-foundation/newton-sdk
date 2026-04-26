import { encodeWasmArgs, type CreateTaskResponse, type TaskIntent } from "@newton-protocol/zktls-sdk";
import type { PolicyDecision, ProofArtifact, TaskFormState, TaskPreview, TaskSubmission } from "./types";

const CID_RE = /\b(?:bafy[a-z2-7]{20,}|Qm[1-9A-HJ-NP-Za-km-z]{44})\b/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export function toHexQuantity(value: string | number | bigint): string {
  if (typeof value === "string" && value.trim().startsWith("0x")) {
    return value.trim().toLowerCase();
  }
  const numeric = typeof value === "bigint" ? value : BigInt(String(value || "0"));
  return `0x${numeric.toString(16)}`;
}

export function buildIntent(form: TaskFormState): TaskIntent {
  return {
    from: form.from,
    to: form.to,
    value: toHexQuantity(form.value),
    data: form.data || "0x",
    chainId: toHexQuantity(form.chainId),
    functionSignature: form.functionSignature || "0x",
  };
}

export function buildWasmArgs(form: Pick<TaskFormState, "minFollowers" | "twitterUsername">) {
  return {
    min_followers: Number(form.minFollowers),
    twitter_username: form.twitterUsername.replace(/^@/, "").trim(),
  };
}

export function buildTaskPreview(form: TaskFormState, proofCid?: string): TaskPreview {
  const wasmArgsJson = buildWasmArgs(form);
  return {
    policyClient: form.policyClient,
    intent: buildIntent(form),
    wasmArgs: encodeWasmArgs(wasmArgsJson),
    wasmArgsJson,
    timeout: Number(form.timeout),
    useTwoPhase: true,
    proofCid,
  };
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function parseMaybeJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function walk(value: unknown, visit: (value: unknown, key?: string) => void, key?: string, seen = new Set<unknown>()): void {
  if (value && typeof value === "object") {
    if (seen.has(value)) return;
    seen.add(value);
  }

  visit(value, key);

  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, String(index), seen));
    return;
  }

  if (value && typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      walk(childValue, visit, childKey, seen);
    }
  }
}

export function extractCid(value: unknown): string | undefined {
  let found: string | undefined;
  walk(value, (item) => {
    if (found || typeof item !== "string") return;
    found = item.match(CID_RE)?.[0];
  });
  return found;
}

function numberFromUnknown(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

export function extractFollowerCount(value: unknown): number | undefined {
  let found: number | undefined;
  walk(value, (item, key) => {
    if (found !== undefined || !key) return;
    if (["followers_count", "followersCount", "follower_count", "followerCount"].includes(key)) {
      found = numberFromUnknown(item);
    }
  });
  return found;
}

export function extractTwitterUsername(value: unknown): string | undefined {
  let found: string | undefined;
  walk(value, (item, key) => {
    if (found || typeof item !== "string" || !key) return;
    if (["screen_name", "screenName", "twitter_username", "twitterUsername", "username"].includes(key)) {
      found = item.replace(/^@/, "");
    }
  });
  return found;
}

export function extractConnectionTime(value: unknown): number | undefined {
  let found: number | undefined;
  walk(value, (item, key) => {
    if (found !== undefined || !key) return;
    if (["tlsn_connection_time", "connectionTime", "connection_time", "notaryTime"].includes(key)) {
      const parsed = numberFromUnknown(item);
      if (parsed !== undefined) found = parsed > 1_000_000_000_000 ? Math.floor(parsed / 1000) : parsed;
    }
  });
  return found;
}

export function extractProofPayload(value: unknown): string | undefined {
  let exact: string | undefined;
  let candidate: string | undefined;

  walk(value, (item, key) => {
    if (exact || typeof item !== "string") return;
    const normalizedKey = key?.toLowerCase() || "";
    const trimmed = item.trim();

    if (CID_RE.test(trimmed) || trimmed.startsWith("http")) return;

    const keyLooksLikeProof = /proof|presentation|attestation|bcs/.test(normalizedKey);
    const valueLooksLikeBase64 = trimmed.length > 80 && BASE64_RE.test(trimmed) && trimmed.length % 4 === 0;

    if (keyLooksLikeProof && trimmed.length > 20) {
      exact = trimmed;
      return;
    }

    if (!candidate && valueLooksLikeBase64) {
      candidate = trimmed;
    }
  });

  return exact ?? candidate;
}

export function normalizeExtensionResult(raw: string): unknown {
  const parsed = parseMaybeJson(raw);
  if (typeof parsed === "string") return parseMaybeJson(parsed);
  return parsed;
}

function findGatewayPolicyResult(value: unknown): Partial<PolicyDecision> | undefined {
  let found: Partial<PolicyDecision> | undefined;

  walk(value, (item) => {
    if (found || !item || typeof item !== "object" || Array.isArray(item)) return;
    const obj = item as Record<string, unknown>;
    const allow = obj.allow;
    const followers = obj.followers_count ?? obj.followersCount;
    const minRequired = obj.min_required ?? obj.minRequired;
    const checks = obj.checks;
    if (typeof allow === "boolean" || followers !== undefined || checks !== undefined) {
      found = {
        status: allow === true ? "allow" : allow === false ? "deny" : "pending",
        source: "gateway",
        followersCount: numberFromUnknown(followers),
        minRequired: numberFromUnknown(minRequired) ?? 0,
        server: typeof obj.server === "string" ? obj.server : undefined,
        proofAgeSecs: numberFromUnknown(obj.proof_age_secs ?? obj.proofAgeSecs),
        checks: normalizeChecks(checks),
        reasons: extractReasons(obj.reasons),
      };
    }
  });

  return found;
}

function normalizeChecks(value: unknown): PolicyDecision["checks"] {
  const obj = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    tlsn_proof_valid: boolOrUnknown(obj.tlsn_proof_valid ?? obj.tlsnProofValid),
    correct_server: boolOrUnknown(obj.correct_server ?? obj.correctServer),
    proof_is_fresh: boolOrUnknown(obj.proof_is_fresh ?? obj.proofIsFresh),
    meets_follower_threshold: boolOrUnknown(obj.meets_follower_threshold ?? obj.meetsFollowerThreshold),
  };
}

function boolOrUnknown(value: unknown): boolean | "unknown" {
  return typeof value === "boolean" ? value : "unknown";
}

function extractReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function secondsSince(unixSeconds: number): number {
  return Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
}

export function derivePolicyDecision(
  response: TaskSubmission | undefined,
  artifact: ProofArtifact | undefined,
  minFollowers: number,
): PolicyDecision {
  const gatewayResult = response ? findGatewayPolicyResult(response) : undefined;
  if (gatewayResult) {
    return {
      status: gatewayResult.status ?? "pending",
      source: "gateway",
      followersCount: gatewayResult.followersCount,
      minRequired: gatewayResult.minRequired || minFollowers,
      server: gatewayResult.server,
      proofAgeSecs: gatewayResult.proofAgeSecs,
      checks: gatewayResult.checks ?? normalizeChecks(undefined),
      reasons: gatewayResult.reasons ?? [],
    };
  }

  if (response && "status" in response && response.status === "failed") {
    return {
      status: "deny",
      source: "gateway",
      minRequired: minFollowers,
      checks: normalizeChecks(undefined),
      reasons: [(response as CreateTaskResponse).error || "Gateway returned failed status"],
    };
  }

  if (!artifact) {
    return {
      status: "pending",
      source: "not-available",
      minRequired: minFollowers,
      checks: normalizeChecks(undefined),
      reasons: ["Generate or paste a proof CID before submitting."],
    };
  }

  const proofAgeSecs = artifact.connectionTime ? secondsSince(artifact.connectionTime) : undefined;
  const followerCheck = artifact.followerCount === undefined ? "unknown" : artifact.followerCount >= minFollowers;
  const freshCheck = proofAgeSecs === undefined ? "unknown" : proofAgeSecs >= 0 && proofAgeSecs < 3600;
  const serverCheck = artifact.server === "api.x.com" || artifact.server === "api.twitter.com";
  const proofCheck = Boolean(artifact.cid);

  const allKnownAllow = proofCheck && serverCheck && freshCheck !== false && followerCheck === true;
  const knownDeny = freshCheck === false || followerCheck === false || !serverCheck || !proofCheck;

  const reasons: string[] = [];
  if (!proofCheck) reasons.push("No proof CID is available.");
  if (!serverCheck) reasons.push("Proof server is not api.x.com or api.twitter.com.");
  if (freshCheck === false) reasons.push("Proof is older than the one-hour policy default.");
  if (followerCheck === false && artifact.followerCount !== undefined) {
    reasons.push(`Followers count ${artifact.followerCount} is below minimum ${minFollowers}.`);
  }
  if (!reasons.length && response) reasons.push("Gateway accepted the task; no structured policy result was included in the response.");

  return {
    status: allKnownAllow ? "allow" : knownDeny ? "deny" : "pending",
    source: "local-preview",
    followersCount: artifact.followerCount,
    minRequired: minFollowers,
    server: artifact.server,
    proofAgeSecs,
    checks: {
      tlsn_proof_valid: proofCheck,
      correct_server: serverCheck,
      proof_is_fresh: freshCheck,
      meets_follower_threshold: followerCheck,
    },
    reasons,
  };
}
