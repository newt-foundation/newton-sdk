let nextId = 0;

function getNextId() {
  return ++nextId;
}

export function createJsonRpcRequestPayload(
  method: string,
  params: any,
): { jsonrpc: string; id: number; method: string; params: any } {
  return {
    jsonrpc: '2.0',
    id: getNextId(),
    method,
    params,
  };
}
