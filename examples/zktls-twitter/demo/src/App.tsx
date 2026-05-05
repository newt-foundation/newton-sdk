import { useCallback, useMemo, useState } from "react";
import { getDemoConfig } from "./config";
import { ConsoleOutput } from "./components/ConsoleOutput";
import { ProofPanel } from "./components/ProofPanel";
import { SystemChecks } from "./components/SystemChecks";
import { TaskPanel } from "./components/TaskPanel";
import { newtonDemoServices } from "./services/newtonFlow";
import type { ConsoleEntry, DemoServices, PolicyVisualization, ProofGenerationResult, SystemChecks as SystemChecksState } from "./types";
import { extractPolicyVisualization, formatTimestamp } from "./utils";
import "./App.css";

const idleChecks: SystemChecksState = {
  browser: { status: "idle", message: "Not checked" },
  extension: { status: "idle", message: "Not checked" },
  gateway: { status: "idle", message: "Not checked" },
  attester: { status: "idle", message: "Not checked" },
};

interface AppProps {
  services?: DemoServices;
}

function createConsoleEntry(message: string, type: ConsoleEntry["type"] = "info"): ConsoleEntry {
  return {
    id: `${Date.now()}-${Math.random()}`,
    timestamp: formatTimestamp(),
    message,
    type,
  };
}

export function App({ services = newtonDemoServices }: AppProps) {
  const config = useMemo(() => getDemoConfig(), []);
  const sdk = useMemo(() => services.createSdk(config), [config, services]);
  const [checks, setChecks] = useState<SystemChecksState>(idleChecks);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([
    createConsoleEntry("Newton zkTLS Twitter demo initialized. Run system checks to begin.", "info"),
  ]);
  const [checking, setChecking] = useState(false);
  const [generatingProof, setGeneratingProof] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [twitterUsername, setTwitterUsername] = useState("newton_protocol");
  const [minFollowers, setMinFollowers] = useState(1000);
  const [proof, setProof] = useState<ProofGenerationResult>();
  const [policyResult, setPolicyResult] = useState<PolicyVisualization>();

  const log = useCallback((message: string, type: ConsoleEntry["type"] = "info") => {
    setConsoleEntries((entries) => [...entries, createConsoleEntry(message, type)]);
  }, []);

  const runChecks = useCallback(async () => {
    setChecking(true);
    setChecks({
      browser: { status: "checking", message: "Checking browser APIs..." },
      extension: { status: "checking", message: "Checking TLSNotary extension bridge..." },
      gateway: { status: "checking", message: "Checking gateway health..." },
      attester: { status: "checking", message: "Checking attester sidecar health..." },
    });
    log("Running browser, extension, gateway, and attester health checks...");
    try {
      const nextChecks = await services.checkSystem(config);
      setChecks(nextChecks);
      const allPass = Object.values(nextChecks).every((check) => check.status === "success");
      log(allPass ? "All system checks passed" : "One or more system checks failed", allPass ? "success" : "warning");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`System checks failed: ${message}`, "error");
    } finally {
      setChecking(false);
    }
  }, [config, log, services]);

  const generateProof = useCallback(async () => {
    setGeneratingProof(true);
    setPolicyResult(undefined);
    setProof(undefined);
    log(`Creating MPC-TLS session for @${twitterUsername} via x.com UserByScreenName...`);
    try {
      const generated = await services.generateProof(sdk, {
        twitterUsername,
        minFollowers,
        attesterUrl: config.sidecarUrl,
      });
      setProof(generated);
      log(`Stored TLSNotary proof to IPFS: ${generated.cid}`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Proof generation failed: ${message}`, "error");
    } finally {
      setGeneratingProof(false);
    }
  }, [config.sidecarUrl, log, minFollowers, sdk, services, twitterUsername]);

  const submitTask = useCallback(async () => {
    if (!proof) return;
    setSubmittingTask(true);
    log(`Submitting newt_createTask with proof CID ${proof.cid}...`);
    try {
      const response = await services.submitTask(sdk, {
        policyClient: config.policyClient,
        from: config.intentFrom,
        to: config.intentTo,
        chainId: config.chainId,
        proofCid: proof.cid,
        minFollowers,
        twitterUsername,
      });
      setPolicyResult(extractPolicyVisualization(response, minFollowers, proof));
      log(`Task ${response.taskId ?? "sync"} returned status ${response.status}`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Task submission failed: ${message}`, "error");
    } finally {
      setSubmittingTask(false);
    }
  }, [config.chainId, config.intentFrom, config.intentTo, config.policyClient, log, minFollowers, proof, sdk, services, twitterUsername]);

  return (
    <main className="app-container">
      <section className="hero-section">
        <p className="eyebrow">Newton Protocol SDK Demo</p>
        <h1>zkTLS Twitter/X follower verification</h1>
        <p>
          Generate a TLSNotary proof for Twitter/X follower count, store it on IPFS, and submit it to
          Newton policy evaluation through the local TypeScript SDK.
        </p>
      </section>

      <SystemChecks checks={checks} checking={checking} onRunChecks={runChecks} />
      <ProofPanel
        twitterUsername={twitterUsername}
        minFollowers={minFollowers}
        running={generatingProof}
        proof={proof}
        onUsernameChange={setTwitterUsername}
        onMinFollowersChange={setMinFollowers}
        onGenerate={generateProof}
      />
      <TaskPanel proof={proof} running={submittingTask} result={policyResult} onSubmitTask={submitTask} />
      <ConsoleOutput entries={consoleEntries} onClear={() => setConsoleEntries([createConsoleEntry("Console cleared")])} />
    </main>
  );
}
