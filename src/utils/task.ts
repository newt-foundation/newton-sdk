import { NormalizedIntent, TaskResponseResult } from '@core/types/task';
import { encodePacked, Hex, hexToBigInt, keccak256 } from 'viem';
import { normalizeIntent } from './intent';
import { TaskRespondedLog } from '@core/abis/newtonAbi';

const addHexPrefix = (input: string): Hex => {
  return input.startsWith('0x') ? (input as `0x${string}`) : (`0x${input}` as `0x${string}`);
};

export const getEvaluationRequestHash = (args: {
  policyClient: `0x${string}`;
  intent: NormalizedIntent;
  quorumNumber?: string;
  quorumThresholdPercentage?: number;
  wasmArgs?: string;
  timeout: number;
}) => {
  const { policyClient, quorumNumber, quorumThresholdPercentage, wasmArgs, timeout } = args;
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
        'bytes', // wasmArgs
        'uint64', // timeout
      ],
      [
        policyClient,
        normalizedIntent.from,
        normalizedIntent.to,
        normalizedIntent.value,
        addHexPrefix(normalizedIntent.data),
        normalizedIntent.chainId,
        addHexPrefix(normalizedIntent.functionSignature),
        quorumNumber ? addHexPrefix(quorumNumber) : '0x',
        quorumThresholdPercentage ?? 0,
        wasmArgs ? addHexPrefix(wasmArgs) : '0x',
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
    evaluationResult: !!(log.args.taskResponse.evaluationResult && hexToBigInt(log.args.taskResponse.evaluationResult)),
  };

  const responseCertificate = {
    taskResponsedBlock: Number(log.args.responseCertificate.taskResponsedBlock),
    responseExpireBlock: Number(log.args.responseCertificate.responseExpireBlock),
    hashOfNonSigners: log.args.responseCertificate.hashOfNonSigners,
  };

  const attestation = {
    taskId: taskResponse.taskId,
    policyId: taskResponse.policyId,
    policyClient: taskResponse.policyClient,
    intent: taskResponse.intent,
    expiration: responseCertificate.responseExpireBlock,
  };

  return {
    taskResponse,
    responseCertificate,
    attestation,
  };
}
