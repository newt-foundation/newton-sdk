import { NormalizedIntent, TaskResponseResult } from '@core/types/task';
import { encodePacked, Hex, keccak256 } from 'viem';
import { normalizeIntent } from './intent';
import { normalizeBytes } from './bytes';
import { TaskRespondedLog } from '@core/abis/newtonAbi';
import { getAttestation } from './attestation';

export const getEvaluationRequestHash = (args: {
  policyClient: `0x${string}`;
  intent: NormalizedIntent;
  quorumNumber?: Hex;
  quorumThresholdPercentage?: number;
  timeout: number;
}) => {
  const { policyClient, quorumNumber, quorumThresholdPercentage, timeout } = args;
  const normalizedIntent = normalizeIntent(args.intent);

  const hash = keccak256(
    encodePacked(
      [
        'address', // policyClient
        'address', // intent.from
        'address', // intent.to
        'uint256', // intent.value
        'bytes', // intent.data
        'uint256', // intent.chainId
        'bytes', // intent.functionSignature
        'bytes', // quorumNumber
        'uint32', // quorumThresholdPercentage
        'uint64', // timeout
      ],
      [
        policyClient,
        normalizedIntent.from,
        normalizedIntent.to,
        normalizedIntent.value,
        normalizedIntent.data,
        normalizedIntent.chainId,
        normalizedIntent.functionSignature,
        quorumNumber ? normalizeBytes(quorumNumber) : '0x',
        quorumThresholdPercentage ?? 0,
        BigInt(timeout),
      ],
    ),
  );

  return hash;
};

export function convertLogToTaskResponse(log: TaskRespondedLog): TaskResponseResult {
  const taskResponse = {
    ...log.args.taskResponse,
    intent: {
      ...log.args.taskResponse.intent,
      value: BigInt(log.args.taskResponse.intent.value),
      data: log.args.taskResponse.intent.data,
      chainId: BigInt(log.args.taskResponse.intent.chainId),
    },
  };

  const taskResponseMetadata = {
    taskResponsedBlock: Number(log.args.taskResponseMetadata.taskResponsedBlock),
    responseExpireBlock: Number(log.args.taskResponseMetadata.responseExpireBlock),
    hashOfNonSigners: log.args.taskResponseMetadata.hashOfNonSigners,
  };

  const attestation = getAttestation({
    taskId: taskResponse.taskId,
    policyId: taskResponse.policyId,
    policyClient: taskResponse.policyClient,
    intent: taskResponse.intent,
    expiration: taskResponseMetadata.responseExpireBlock,
  }) as Hex;

  return {
    taskResponse,
    taskResponseMetadata,
    attestation,
  };
}
