import { Call, CallUnencoded } from '@core/types';
import { encodeFunctionData } from 'viem';

export const normalizeCalls = (calls: Call[]) => {
  return calls.map(call => {
    if ((call as CallUnencoded).functionName && (call as CallUnencoded).abi && (call as CallUnencoded).args) {
      return {
        value: call.value,
        to: call.to,
        data: encodeFunctionData({
          abi: (call as CallUnencoded).abi,
          functionName: (call as CallUnencoded).functionName,
          args: (call as CallUnencoded).args,
        }),
      };
    }
    return call;
  });
};
