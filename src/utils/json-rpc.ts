export function createJsonRpcRequestPayload(
  method: string,
  params: unknown,
): { jsonrpc: string; method: string; params: unknown } {
  return {
    jsonrpc: '2.0',
    method,
    params,
  }
}
