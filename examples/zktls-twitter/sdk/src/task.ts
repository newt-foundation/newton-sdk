/**
 * Newton Protocol Task lifecycle manager.
 *
 * Provides a high-level API for the full task flow:
 *   1. Create or send task via Gateway RPC
 *   2. Track async tasks via WebSocket subscription
 *   3. Collect final result
 */

import type {
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

export interface TaskOptions {
  /** Policy client contract address */
  policyClient: string;
  /** Transaction intent */
  intent: TaskIntent;
  /** WASM arguments (will be hex-encoded if provided as an object) */
  wasmArgs?: string | Record<string, unknown>;
  /** Timeout in seconds (gateway-side, default: 60) */
  timeout?: number;
  /** Enable two-phase consensus (default: true for zkTLS) */
  useTwoPhase?: boolean;
  /** IPFS CID of a TLSNotary proof */
  proofCid?: string;
  /** Include validate calldata in response */
  includeValidateCalldata?: boolean;
}

type WebSocketLike = {
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
};

type WebSocketConstructor = new (url: string) => WebSocketLike;

export class TaskManager {
  private readonly gateway: GatewayClient;
  private readonly wsBaseUrl: string;
  private wsImpl: WebSocketConstructor | undefined;
  private readonly timeout: number;

  constructor(config: NewtonSDKConfig, gateway?: GatewayClient) {
    this.gateway = gateway ?? new GatewayClient(config);
    this.wsBaseUrl = config.gatewayUrl
      .replace(/\/rpc$/, "")
      .replace(/^http/, "ws");
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
   * @param topic - Subscription topic from SendTaskResponse
   * @param onUpdate - Callback for each task update event
   * @param timeoutMs - Maximum time to wait for completion (default: SDK timeout)
   * @returns Promise that resolves with the final TaskUpdateEvent on success/failure
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

      const ws = new WS(`${this.wsBaseUrl}/ws?topic=${encodeURIComponent(topic)}`);
      const timer = setTimeout(() => {
        ws.close();
        reject(new TimeoutError(effectiveTimeout));
      }, effectiveTimeout);

      ws.onmessage = (ev) => {
        try {
          const event = JSON.parse(String(ev.data)) as TaskUpdateEvent;
          onUpdate?.(event);

          if (event.event === "success" || event.event === "failure") {
            clearTimeout(timer);
            ws.close();
            resolve(event);
          }
        } catch {
          // Ignore non-JSON frames
        }
      };

      ws.onerror = (ev) => {
        clearTimeout(timer);
        reject(new SessionError(`Task tracking WebSocket error: ${ev}`));
      };

      ws.onclose = () => {
        clearTimeout(timer);
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
    return this.trackTask(response.subscriptionTopic, onUpdate, timeoutMs);
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private resolveWasmArgs(
    wasmArgs: string | Record<string, unknown> | undefined,
  ): string | undefined {
    if (wasmArgs === undefined) return undefined;
    if (typeof wasmArgs === "string") return wasmArgs;
    return encodeWasmArgs(wasmArgs);
  }

  private buildCreateRequest(options: TaskOptions): CreateTaskRequest {
    return {
      policyClient: options.policyClient,
      intent: options.intent,
      wasmArgs: this.resolveWasmArgs(options.wasmArgs),
      timeout: options.timeout ?? 60,
      useTwoPhase: options.useTwoPhase,
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
