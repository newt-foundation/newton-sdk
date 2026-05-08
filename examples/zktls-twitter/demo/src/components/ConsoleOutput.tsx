import type { ConsoleEntry } from "../types";

interface ConsoleOutputProps {
  entries: ConsoleEntry[];
  onClear: () => void;
}

export function ConsoleOutput({ entries, onClear }: ConsoleOutputProps) {
  return (
    <section className="content-card console-card" aria-labelledby="console-title">
      <div className="section-header">
        <h2 id="console-title">Console output</h2>
        <button type="button" className="secondary" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="console-output" role="log" aria-live="polite">
        {entries.map((entry) => (
          <div key={entry.id} className={`console-entry ${entry.type}`}>
            <span className="console-timestamp">[{entry.timestamp}]</span>
            <span>{entry.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
