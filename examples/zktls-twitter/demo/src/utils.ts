import type { PolicyVisualization, ProofGenerationResult } from "./types";

export function formatTimestamp(date = new Date()): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function isChromeLikeBrowser(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes("chrome") || userAgent.includes("chromium") || userAgent.includes("edg/");
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function readSuccessStatus(value: unknown): boolean {
  const record = readRecord(value);
  if (!record) return false;

  const status = record.status;
  if (typeof status === "string" && status.toLowerCase() === "success") {
    return true;
  }

  return Boolean(readSuccessStatus(record.taskResponse) || readSuccessStatus(record.aggregationResponse));
}

export function extractPolicyVisualization(
  response: unknown,
  fallbackThreshold: number,
  proof?: ProofGenerationResult,
): PolicyVisualization {
  const root = readRecord(response) ?? {};
  const candidates = [
    root.result,
    root.taskResponse,
    readRecord(root.aggregationResponse)?.result,
    readRecord(root.taskResponse)?.result,
    root,
  ];

  for (const candidate of candidates) {
    const record = readRecord(candidate);
    if (!record) continue;

    const allow = typeof record.allow === "boolean" ? record.allow : undefined;
    const followersCount = readNumber(record.followers_count ?? record.followersCount);
    const threshold = readNumber(record.min_required ?? record.minRequired ?? record.threshold);
    const checks = readRecord(record.checks);

    if (allow !== undefined || followersCount !== undefined || checks) {
      return {
        allow: allow ?? false,
        followersCount: followersCount ?? 0,
        threshold: threshold ?? fallbackThreshold,
        server: typeof record.server === "string" ? record.server : undefined,
        proofAgeSecs: readNumber(record.proof_age_secs ?? record.proofAgeSecs),
        checks: (checks ?? {}) as PolicyVisualization["checks"],
        raw: response,
      };
    }
  }

  if (proof && readSuccessStatus(response)) {
    const followersCount = proof.followerCount;
    const allow = followersCount >= fallbackThreshold;

    return {
      allow,
      followersCount,
      threshold: fallbackThreshold,
      server: proof.serverName,
      checks: {
        tlsn_proof_valid: true,
        correct_server: true,
        proof_is_fresh: true,
        meets_follower_threshold: allow,
      },
      raw: response,
    };
  }

  return {
    allow: false,
    followersCount: 0,
    threshold: fallbackThreshold,
    checks: {},
    raw: response,
  };
}
