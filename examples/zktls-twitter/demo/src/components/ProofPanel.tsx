import type { FormEvent } from "react";
import type { ProofGenerationResult } from "../types";

interface ProofPanelProps {
  twitterUsername: string;
  minFollowers: number;
  running: boolean;
  proof?: ProofGenerationResult;
  onUsernameChange: (value: string) => void;
  onMinFollowersChange: (value: number) => void;
  onGenerate: () => void;
}

export function ProofPanel({
  twitterUsername,
  minFollowers,
  running,
  proof,
  onUsernameChange,
  onMinFollowersChange,
  onGenerate,
}: ProofPanelProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onGenerate();
  };

  return (
    <section className="content-card" aria-labelledby="proof-title">
      <h2 id="proof-title">MPC-TLS proof generation</h2>
      <p>
        Connect to the Newton attester WebSocket, proxy the Twitter/X request to <code>api.x.com</code>,
        generate a TLSNotary presentation, then store the proof to IPFS.
      </p>
      <form className="form-grid" onSubmit={submit}>
        <label>
          Twitter/X username
          <input
            value={twitterUsername}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder="newton_protocol"
          />
        </label>
        <label>
          Minimum followers
          <input
            type="number"
            min={0}
            value={minFollowers}
            onChange={(event) => onMinFollowersChange(Number(event.target.value))}
          />
        </label>
        <button type="submit" disabled={running || !twitterUsername}>
          {running ? "Generating proof..." : "Generate proof + CID"}
        </button>
      </form>
      {proof && (
        <div className="result-box success" data-testid="proof-result">
          <strong>Proof stored:</strong> <code>{proof.cid}</code>
          <dl>
            <dt>Followers disclosed</dt>
            <dd>{proof.followerCount.toLocaleString()}</dd>
            <dt>Attester session</dt>
            <dd>{proof.sessionId}</dd>
            <dt>Proxy</dt>
            <dd>{proof.proxyUrl}</dd>
          </dl>
        </div>
      )}
    </section>
  );
}
