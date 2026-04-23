import type { SystemChecks as SystemChecksState } from "../types";

interface SystemChecksProps {
  checks: SystemChecksState;
  onRunChecks: () => void;
  checking: boolean;
}

function CheckItem({ label, message, status }: { label: string; message: string; status: string }) {
  return (
    <div className={`check-item ${status}`} data-testid={`check-${label.toLowerCase()}`}>
      <strong>{label}</strong>
      <span>{message}</span>
    </div>
  );
}

export function SystemChecks({ checks, onRunChecks, checking }: SystemChecksProps) {
  return (
    <section className="content-card" aria-labelledby="system-checks-title">
      <div className="section-header">
        <h2 id="system-checks-title">System status checks</h2>
        <button type="button" className="secondary" onClick={onRunChecks} disabled={checking}>
          {checking ? "Checking..." : "Run checks"}
        </button>
      </div>
      <div className="check-grid">
        <CheckItem label="Browser" {...checks.browser} />
        <CheckItem label="Gateway" {...checks.gateway} />
        <CheckItem label="Attester" {...checks.attester} />
      </div>
    </section>
  );
}
