import type { TaskRespondedLog } from '@core/abis/newtonAbi'
import type { TaskResponse, TaskResponseResult } from '@core/types/task'

export function convertLogToTaskResponse(log: TaskRespondedLog): TaskResponseResult {
  const taskResponse = {
    ...log.args.taskResponse,
    intent: { ...log.args.taskResponse.intent },
    // Kept as decoded: per-policy order is load-bearing.
    policyTaskData: [...log.args.taskResponse.policyTaskData],
  } as unknown as TaskResponse

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
