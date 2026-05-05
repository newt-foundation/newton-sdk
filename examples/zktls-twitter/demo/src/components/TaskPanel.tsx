import type { FormEvent } from "react";
import type { PolicyVisualization, ProofGenerationResult } from "../types";

interface TaskPanelProps {
  proof?: ProofGenerationResult;
  running: boolean;
  result?: PolicyVisualization;
  onSubmitTask: () => void;
}

function CheckPill({ label, value }: { label: string; value: boolean | undefined }) {
  const passed = value === true;
  return <span className={`pill ${passed ? "pass" : "fail"}`}>{passed ? "✓" : "×"} {label}</span>;
}

export function TaskPanel({ proof, running, result, onSubmitTask }: TaskPanelProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmitTask();
  };

  return (
    <section className="content-card" aria-labelledby="task-title">
      <h2 id="task-title">Task submission</h2>
      <p>
        Submit the proof CID through <code>newt_createTask</code> using SDK task manager options with
        <code> useTwoPhase: true</code> and Twitter follower policy WASM args.
      </p>
      <form onSubmit={submit}>
        <button type="submit" disabled={running || !proof}>
          {running ? "Submitting task..." : "Submit Newton task"}
        </button>
      </form>
      {!proof && <p className="hint">Generate and store a proof before submitting a task.</p>}
      {result && (
        <div className={`result-box ${result.allow ? "success" : "error"}`} data-testid="policy-result">
          <h3>{result.allow ? "ALLOW" : "DENY"}</h3>
          <p>
            Followers: <strong>{result.followersCount.toLocaleString()}</strong> / Threshold:{" "}
            <strong>{result.threshold.toLocaleString()}</strong>
          </p>
          {result.server && <p>Verified server: {result.server}</p>}
          {result.proofAgeSecs !== undefined && <p>Proof age: {Math.round(result.proofAgeSecs)}s</p>}
          <div className="pill-row" aria-label="Detailed check results">
            <CheckPill label="TLS proof" value={result.checks.tlsn_proof_valid} />
            <CheckPill label="Server" value={result.checks.correct_server} />
            <CheckPill label="Fresh" value={result.checks.proof_is_fresh} />
            <CheckPill label="Followers" value={result.checks.meets_follower_threshold} />
          </div>
        </div>
      )}
    </section>
  );
}
