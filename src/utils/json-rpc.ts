function generateId(): string {
  // Generate 20 bytes (40 hex characters) as required by the API
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);

  // Convert to hex string of length 40
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function createJsonRpcRequestPayload(
  method: string,
  params: any,
): { jsonrpc: string; id: string; method: string; params: any } {
  return {
    jsonrpc: '2.0',
    id: generateId(),
    method,
    params,
  };
}
