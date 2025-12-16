function generateId(): string {
  // Generate UUID v4 in standard format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

  // Convert to hex string and format with dashes
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
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
