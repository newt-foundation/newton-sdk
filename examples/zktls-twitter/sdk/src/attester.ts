/**
 * Newton Protocol Attester WebSocket client.
 *
 * Manages MPC-TLS sessions through the three-endpoint flow:
 *   /session → /verifier → /proxy
 *
 * This client handles the session coordination layer (text/JSON over WebSocket).
 * The actual MPC-TLS binary protocol over /verifier is handled by the prover
 * library (typically WASM or native). This client provides:
 *
 * 1. Session creation and management
 * 2. Reveal configuration
 * 3. Result collection
 */

import type {
  HandlerResult,
  NewtonSDKConfig,
  RevealConfigMessage,
  SessionClientMessage,
  SessionServerMessage,
} from "./types.js";
import { SessionError } from "./errors.js";

export interface AttesterSession {
  sessionId: string;
  verifierUrl: string;
  proxyUrl: (host: string) => string;
}

export interface SessionOptions {
  maxRecvData?: number;
  maxSentData?: number;
}

type WebSocketLike = {
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  readyState: number;
};

type WebSocketConstructor = new (url: string) => WebSocketLike;

export class AttesterClient {
  private readonly baseUrl: string;
  private readonly wsBaseUrl: string;
  private readonly headers: Record<string, string>;
  private wsImpl: WebSocketConstructor | undefined;

  constructor(config: NewtonSDKConfig) {
    const url = config.attesterUrl ?? config.gatewayUrl.replace(/\/rpc$/, "");
    this.baseUrl = url.replace(/\/+$/, "");
    this.wsBaseUrl = this.baseUrl.replace(/^http/, "ws");

    this.headers = {};
    if (config.apiKey) {
      this.headers["Authorization"] = `Bearer ${config.apiKey}`;
    }
  }

  /**
   * Provide a WebSocket implementation (required in Node.js).
   * In browsers, the global WebSocket is used automatically.
   */
  setWebSocket(impl: WebSocketConstructor): void {
    this.wsImpl = impl;
  }

  /**
   * Create a new MPC-TLS session.
   *
   * Returns a session handle with URLs for /verifier and /proxy connections.
   */
  async createSession(options?: SessionOptions): Promise<AttesterSession> {
    const maxRecvData = options?.maxRecvData ?? 16384;
    const maxSentData = options?.maxSentData ?? 4096;

    return new Promise<AttesterSession>((resolve, reject) => {
      const ws = this.createWebSocket(`${this.wsBaseUrl}/session`);

      ws.onopen = () => {
        const msg: SessionClientMessage = {
          type: "register",
          maxRecvData,
          maxSentData,
        };
        ws.send(JSON.stringify(msg));
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as SessionServerMessage;
          if (data.type === "sessionRegistered") {
            ws.close();
            resolve({
              sessionId: data.sessionId,
              verifierUrl: `${this.wsBaseUrl}/verifier?sessionId=${data.sessionId}`,
              proxyUrl: (host: string) =>
                `${this.wsBaseUrl}/proxy?token=${encodeURIComponent(host)}&session=${data.sessionId}`,
            });
          } else if (data.type === "error") {
            reject(new SessionError(data.message));
            ws.close();
          }
        } catch (err) {
          reject(new SessionError(`Failed to parse session message: ${err}`));
          ws.close();
        }
      };

      ws.onerror = (ev) => {
        reject(new SessionError(`WebSocket error: ${ev}`));
      };
    });
  }

  /**
   * Send a reveal configuration and wait for session completion results.
   *
   * This is called after the MPC-TLS protocol has completed over /verifier.
   * The reveal config specifies which byte ranges of the TLS transcript to disclose.
   */
  async reveal(
    sessionWsUrl: string,
    config: Omit<RevealConfigMessage, "type">,
  ): Promise<HandlerResult[]> {
    return new Promise<HandlerResult[]>((resolve, reject) => {
      const ws = this.createWebSocket(sessionWsUrl);

      ws.onopen = () => {
        const msg: RevealConfigMessage = {
          type: "revealConfig",
          ...config,
        };
        ws.send(JSON.stringify(msg));
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as SessionServerMessage;
          if (data.type === "sessionCompleted") {
            resolve(data.results);
            ws.close();
          } else if (data.type === "error") {
            reject(new SessionError(data.message));
            ws.close();
          }
        } catch (err) {
          reject(new SessionError(`Failed to parse message: ${err}`));
          ws.close();
        }
      };

      ws.onerror = (ev) => {
        reject(new SessionError(`WebSocket error: ${ev}`));
      };
    });
  }

  private createWebSocket(url: string): WebSocketLike {
    const WS =
      this.wsImpl ??
      (typeof globalThis !== "undefined" && (globalThis as Record<string, unknown>).WebSocket
        ? ((globalThis as Record<string, unknown>).WebSocket as WebSocketConstructor)
        : undefined);

    if (!WS) {
      throw new SessionError(
        "No WebSocket implementation available. " +
          "In Node.js, call attester.setWebSocket(WebSocket) with the 'ws' package.",
      );
    }

    return new WS(url);
  }
}
