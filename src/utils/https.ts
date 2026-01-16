import { GATEWAY_API_URLS } from '@core/const';
import { createJsonRpcRequestPayload } from './json-rpc';

export class AvsHttpService {
  private baseUrl;

  constructor(chainId: number, urlOverride?: string) {
    this.baseUrl = urlOverride || GATEWAY_API_URLS[chainId];
  }

  async Post(method: string, args: unknown, apiKey: string) {
    const body = createJsonRpcRequestPayload(method, args);
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
    });
    return response.json();
  }
}
