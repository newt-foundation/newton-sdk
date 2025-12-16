import { MAINNET_GATEWAY_API, TESTNET_GATEWAY_API } from '@core/const';
import { createJsonRpcRequestPayload } from './json-rpc';

export class AvsHttpService {
  private baseUrl;

  constructor(testMode: boolean, urlOverride?: string) {
    this.baseUrl = urlOverride || (testMode ? TESTNET_GATEWAY_API : MAINNET_GATEWAY_API);
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
