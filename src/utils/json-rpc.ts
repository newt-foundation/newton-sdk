import { randomUUID } from 'crypto';

export function createJsonRpcRequestPayload(
  method: string,
  params: any,
): { jsonrpc: string; id: string; method: string; params: any } {
  return {
    jsonrpc: '2.0',
    id: randomUUID(),
    method,
    params,
  };
}
