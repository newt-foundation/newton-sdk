import type { TaskRespondedLog } from '@core/abis/newtonAbi'
import type { TaskResponseResult } from '@core/types/task'
import { hexToBigInt } from 'viem'

export function convertLogToTaskResponse(log: TaskRespondedLog): TaskResponseResult {
  const taskResponse = {
    ...log.args.taskResponse,
    intent: { ...log.args.taskResponse.intent },
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
