import { TaskResponseResult } from '@core/types/task';
import { hexToBigInt } from 'viem';
import { TaskRespondedLog } from '@core/abis/newtonAbi';

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
    intentSignature: taskResponse.intentSignature,
    expiration: responseCertificate.responseExpireBlock,
  };

  return {
    taskResponse,
    responseCertificate,
    attestation,
  };
}
