import type { TaskRespondedLog } from '@core/abis/newtonAbi'
import type { TaskResponseResult } from '@core/types/task'
import { hexToBigInt } from 'viem'

export function convertLogToTaskResponse(log: TaskRespondedLog): TaskResponseResult {
  const taskResponse = {
    ...log.args.taskResponse,
    intent: {
      ...log.args.taskResponse.intent,
      value: log.args.taskResponse.intent.value,
      data: log.args.taskResponse.intent.data,
      chainId: log.args.taskResponse.intent.chainId,
    },
    evaluationResult: !!(log.args.taskResponse.evaluationResult && hexToBigInt(log.args.taskResponse.evaluationResult)),
  }

  const responseCertificate = {
    taskResponsedBlock: log.args.responseCertificate.referenceBlock,
    responseExpireBlock: log.args.responseCertificate.responseExpireBlock,
    hashOfNonSigners: log.args.responseCertificate.hashOfNonSigners,
  }

  const attestation = {
    taskId: taskResponse.taskId,
    policyId: taskResponse.policyId,
    policyClient: taskResponse.policyClient,
    intent: taskResponse.intent,
    intentSignature: taskResponse.intentSignature,
    expiration: responseCertificate.responseExpireBlock,
  }

  return {
    taskResponse,
    responseCertificate,
    attestation,
  }
}
