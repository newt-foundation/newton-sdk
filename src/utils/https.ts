import { MAINNET_AVS_API, TESTNET_AVS_API } from '@core/const';
import { createJsonRpcRequestPayload } from './json-rpc';

export class AvsHttpService {
  private baseUrl;

  constructor(testMode: boolean) {
    this.baseUrl = testMode ? TESTNET_AVS_API : MAINNET_AVS_API;
  }

  async Post(method: string, args: unknown) {
    const body = createJsonRpcRequestPayload(method, args);
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return response.json();
  }
}
