import { MAINNET_AVS_API, TESTNET_AVS_API } from '@core/const';
import { createJsonRpcRequestPayload } from './json-rpc';

export class AvsHttpService {
  private baseUrl;

  constructor(testMode: boolean, urlOverride?: string) {
    this.baseUrl = urlOverride || (testMode ? TESTNET_AVS_API : MAINNET_AVS_API);
  }

  async Post(method: string, args: unknown, authorization?: string) {
    const body = createJsonRpcRequestPayload(method, args);
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return response.json();
  }
}
