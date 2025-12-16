function generateId(): string {
  // Generate UUID v4 (16 bytes = 32 hex characters in simple format)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

  // Convert to hex string of length 32 (simple format, no dashes)
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
