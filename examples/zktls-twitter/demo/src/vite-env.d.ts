/// <reference types="vite/client" />

interface Window {
  tlsn?: {
    execCode(code: string): Promise<string>;
  };
  chrome?: unknown;
}
