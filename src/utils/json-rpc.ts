export function createJsonRpcRequestPayload(
  method: string,
  params: any,
): { jsonrpc: string; method: string; params: any } {
  return {
    jsonrpc: '2.0',
    method,
    params,
  }
}
