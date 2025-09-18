import { NormalizedIntent } from '@core/types/task';
import { encodeAbiParameters, parseAbiParameters } from 'viem';

export function getAttestation(a: {
  taskId: `0x${string}`;
  policyId: `0x${string}`;
  policyClient: `0x${string}`;
  intent: NormalizedIntent;
  expiration: number;
}) {
  const types = parseAbiParameters(
    'bytes32 taskId, bytes32 policyId, address policyClient, (address from,address to,uint256 value,bytes data,uint256 chainId,bytes functionSignature) intent, uint32 expiration',
  );

  const encoded = encodeAbiParameters(types, [a.taskId, a.policyId, a.policyClient, a.intent, a.expiration]);

  return encoded;
}
