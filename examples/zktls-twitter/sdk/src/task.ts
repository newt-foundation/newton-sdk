/**
 * Newton Protocol Task lifecycle manager.
 *
 * Provides a high-level API for the full task flow:
 *   1. Create or send task via Gateway RPC
 *   2. Track async tasks via WebSocket subscription
 *   3. Collect final result
 */

import type {
  Address,
  CreateTaskRequest,
  CreateTaskResponse,
  NewtonSDKConfig,
  SendTaskRequest,
  SendTaskResponse,
  TaskIntent,
  TaskUpdateEvent,
} from "./types.js";
import { GatewayClient } from "./gateway.js";
import { SessionError, TimeoutError } from "./errors.js";
import { encodeWasmArgs } from "./utils.js";
import { formatWebSocketError } from "./attester.js";

/** A hex string, or an object that is sent as hex-encoded JSON. */
type WasmArg = string | Record<string, unknown>;

export interface TaskOptions {
  /** Policy client contract address */
  policyClient: Address;
  /** Transaction intent */
  intent: TaskIntent;
  /**
   * WASM arguments, one per policy in the client's policy set (`"0x"` for a
   * pure-Rego policy). A single value is sent as a one-entry list.
   */
  wasmArgs?: WasmArg | WasmArg[];
  /**
   * Timeout in seconds (gateway-side, default: 60). The gateway's own HTTP
   * request timeout (`server.request_timeout`, 30 in its sample gateway.toml)
   * can end a synchronous createTask first, with a 408.
   */
  timeout?: number;
  /**
   * @deprecated The gateway rejects any value with InvalidRequest "proof_cid is
   * unsupported; zkTLS proof verification is unavailable". Still sent so that
   * rejection reaches the caller instead of the proof being dropped silently.
   */
  proofCid?: string;
  /** Include validate calldata in response */
  includeValidateCalldata?: boolean;
}

type WebSocketLike = {
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
};

type WebSocketConstructor = new (url: string, protocols?: string | string[]) => WebSocketLike;

/** Gateway frames on /ws, tagged by `type`. */
type GatewayWsFrame =
  | { type: "update"; subscription_id: string; result: TaskUpdateEvent }
  | { type: "error"; message: string }
  | { type: "subscribed" | "unsubscribed" | "response" | "pong" };

/** Offered on every connection; the gateway accepts the upgrade by echoing it. */
const WS_SUBPROTOCOL = "newton.v1";
/** Browsers cannot set headers on a WebSocket, so the API key travels as a `newton.bearer.<key>` subprotocol. */
const WS_BEARER_SUBPROTOCOL_PREFIX = "newton.bearer.";
/** RFC 7230 token characters, the only ones a subprotocol may hold. */
const SUBPROTOCOL_TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
/** `data.status` values that end a task. */
const TERMINAL_STATUSES = new Set(["success", "failed", "timeout"]);

/** The gateway's `/ws` endpoint beside its JSON-RPC URL: same host, port and path prefix, `ws:` for `http:`. */
function getTaskEventsUrl(gatewayUrl: string): string {
  const url = new URL(gatewayUrl);
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  url.pathname = url.pathname.replace(/(\/rpc)?\/?$/, "/ws");
  url.search = "";
  url.hash = "";
  return url.toString();
}

export class TaskManager {
  private readonly gateway: GatewayClient;
  private readonly gatewayUrl: string;
  private readonly apiKey: string | undefined;
  private wsImpl: WebSocketConstructor | undefined;
  private readonly timeout: number;

  constructor(config: NewtonSDKConfig, gateway?: GatewayClient) {
    this.gateway = gateway ?? new GatewayClient(config);
    this.gatewayUrl = config.gatewayUrl;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30_000;
  }

  /**
   * Provide a WebSocket implementation (required in Node.js).
   */
  setWebSocket(impl: WebSocketConstructor): void {
    this.wsImpl = impl;
  }

  /**
   * Create a task synchronously — blocks until BLS aggregation completes.
   */
  async createTask(options: TaskOptions): Promise<CreateTaskResponse> {
    const req = this.buildCreateRequest(options);
    return this.gateway.createTask(req);
  }

  /**
   * Send a task asynchronously and track via WebSocket.
   *
   * Returns the SendTaskResponse immediately. Use `trackTask()` to
   * subscribe to updates.
   */
  async sendTask(options: TaskOptions): Promise<SendTaskResponse> {
    const req = this.buildSendRequest(options);
    return this.gateway.sendTask(req);
  }

  /**
   * Subscribe to task updates over WebSocket.
   *
   * Connects to the gateway's `/ws` with the API key as a `newton.bearer.<key>`
   * subprotocol, sends a subscribe frame for `topic`, and passes each `update`
   * frame's event to `onUpdate`.
   *
   * @param topic - `subscription_topic` from SendTaskResponse (bare lowercase hex task id)
   * @param onUpdate - Callback for each task update event
   * @param timeoutMs - Maximum time to wait for completion (default: SDK timeout)
   * @returns Promise that resolves with the first event whose `data.status` is
   *   success, failed or timeout, and rejects on a gateway `error` frame
   */
  async trackTask(
    topic: string,
    onUpdate?: (event: TaskUpdateEvent) => void,
    timeoutMs?: number,
  ): Promise<TaskUpdateEvent> {
    const effectiveTimeout = timeoutMs ?? this.timeout;

    return new Promise<TaskUpdateEvent>((resolve, reject) => {
      const WS =
        this.wsImpl ??
        (typeof globalThis !== "undefined" && (globalThis as Record<string, unknown>).WebSocket
          ? ((globalThis as Record<string, unknown>).WebSocket as WebSocketConstructor)
          : undefined);

      if (!WS) {
        reject(
          new SessionError(
            "No WebSocket implementation available. " +
              "In Node.js, call taskManager.setWebSocket(WebSocket) with the 'ws' package.",
          ),
        );
        return;
      }

      const wsUrl = getTaskEventsUrl(this.gatewayUrl);
      // Checked here because the WebSocket constructor's SyntaxError would print the protocol, key included.
      if (!this.apiKey || !SUBPROTOCOL_TOKEN.test(this.apiKey)) {
        const reason = this.apiKey
          ? "the API key holds characters a WebSocket subprotocol cannot carry"
          : "an API key is required";
        reject(new SessionError(`cannot track task ${topic} at ${wsUrl}: ${reason}`));
        return;
      }

      const ws = new WS(wsUrl, [WS_SUBPROTOCOL, `${WS_BEARER_SUBPROTOCOL_PREFIX}${this.apiKey}`]);
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        ws.close();
        reject(new TimeoutError(effectiveTimeout));
      }, effectiveTimeout);

      const rejectWithCleanup = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ws.close();
        reject(err);
      };

      const resolveWithCleanup = (event: TaskUpdateEvent) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ws.close();
        resolve(event);
      };

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "subscribe", id: "sub-1", method: topic, params: null }));
      };

      ws.onmessage = (ev) => {
        const raw = String(ev.data);
        // Defensive cap matches the AttesterClient frame guard so a hostile
        // or misconfigured upstream cannot OOM the client by streaming a
        // single oversized JSON frame.
        if (raw.length > 1_000_000) {
          rejectWithCleanup(
            new SessionError(`WebSocket frame exceeds 1 MB (${raw.length} bytes)`),
          );
          return;
        }

        let frame: GatewayWsFrame;
        try {
          frame = JSON.parse(raw) as GatewayWsFrame;
        } catch (err) {
          // Non-JSON frames are tolerated to allow gateway-side keepalives or
          // future control frames without settling the outer Promise. Surface
          // at debug so an unexpected upstream format change is not invisible
          // to operators tailing browser DevTools.
          if (typeof console !== "undefined" && typeof console.debug === "function") {
            console.debug("[newton-sdk] trackTask: ignoring non-JSON frame", err);
          }
          return;
        }

        if (frame?.type === "error") {
          rejectWithCleanup(new SessionError(`task ${topic} subscription failed: ${frame.message}`));
          return;
        }
        // `subscribed` and `pong` frames carry no task data.
        if (frame?.type !== "update") return;
        const event = frame.result;

        try {
          onUpdate?.(event);
        } catch (err) {
          rejectWithCleanup(
            err instanceof Error ? err : new SessionError(String(err)),
          );
          return;
        }

        if (TERMINAL_STATUSES.has(event?.data?.status)) {
          resolveWithCleanup(event);
        }
      };

      ws.onerror = (ev) => {
        rejectWithCleanup(
          new SessionError(
            `Task tracking WebSocket error: ${formatWebSocketError(ev)}`,
          ),
        );
      };

      ws.onclose = (ev) => {
        rejectWithCleanup(
          new SessionError(`WebSocket closed: ${formatWebSocketError(ev)}`),
        );
      };
    });
  }

  /**
   * High-level: send task and wait for completion.
   *
   * Combines sendTask() + trackTask() into a single call.
   */
  async submitAndWait(
    options: TaskOptions,
    onUpdate?: (event: TaskUpdateEvent) => void,
    timeoutMs?: number,
  ): Promise<TaskUpdateEvent> {
    const response = await this.sendTask(options);
    return this.trackTask(response.subscription_topic, onUpdate, timeoutMs);
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private resolveWasmArgs(wasmArgs: WasmArg | WasmArg[] | undefined): string[] | undefined {
    if (wasmArgs === undefined) return undefined;
    return (Array.isArray(wasmArgs) ? wasmArgs : [wasmArgs]).map((arg) =>
      typeof arg === "string" ? arg : encodeWasmArgs(arg),
    );
  }

  private buildCreateRequest(options: TaskOptions): CreateTaskRequest {
    return {
      policyClient: options.policyClient,
      intent: options.intent,
      wasmArgs: this.resolveWasmArgs(options.wasmArgs),
      timeout: options.timeout ?? 60,
      proofCid: options.proofCid,
      includeValidateCalldata: options.includeValidateCalldata,
    };
  }

  private buildSendRequest(options: TaskOptions): SendTaskRequest {
    return {
      policyClient: options.policyClient,
      intent: options.intent,
      wasmArgs: this.resolveWasmArgs(options.wasmArgs),
      timeout: options.timeout ?? 60,
      proofCid: options.proofCid,
    };
  }
}
