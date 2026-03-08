import type { TaskRespondedLog } from '@core/abis/newtonAbi'
import { describe, expect, it } from 'vitest'
import { convertLogToTaskResponse } from './task'

function createMockLog(overrides?: Partial<TaskRespondedLog['args']>): TaskRespondedLog {
  return {
    args: {
      taskResponse: {
        taskId: '0xabc123' as `0x${string}`,
        policyClient: '0x1111111111111111111111111111111111111111' as `0x${string}`,
        policyId: '0xdef456' as `0x${string}`,
        policyAddress: '0x2222222222222222222222222222222222222222' as `0x${string}`,
        intent: {
          from: '0x3333333333333333333333333333333333333333' as `0x${string}`,
          to: '0x4444444444444444444444444444444444444444' as `0x${string}`,
          value: '1000',
          data: '0x' as `0x${string}`,
          chainId: '11155111',
          functionSignature: '0xdeadbeef' as `0x${string}`,
        },
        intentSignature: '0xsig' as `0x${string}`,
        evaluationResult: '0x01' as `0x${string}`,
        ...overrides?.taskResponse,
      },
      responseCertificate: {
        taskResponsedBlock: '100',
        responseExpireBlock: '200',
        hashOfNonSigners: '0xhash' as `0x${string}`,
        ...overrides?.responseCertificate,
      },
    },
  } as TaskRespondedLog
}

describe('convertLogToTaskResponse', () => {
  it('converts intent value and chainId to bigint', () => {
    const log = createMockLog()
    const result = convertLogToTaskResponse(log)

    expect(result.taskResponse.intent.value).toBe(1000n)
    expect(result.taskResponse.intent.chainId).toBe(11155111n)
  })

  it('converts responseCertificate block numbers to number', () => {
    const log = createMockLog()
    const result = convertLogToTaskResponse(log)

    expect(result.responseCertificate.taskResponsedBlock).toBe(100)
    expect(result.responseCertificate.responseExpireBlock).toBe(200)
  })

  it('converts non-zero evaluationResult to true', () => {
    const log = createMockLog()
    const result = convertLogToTaskResponse(log)

    expect(result.taskResponse.evaluationResult).toBe(true)
  })

  it('converts zero evaluationResult to false', () => {
    const log = createMockLog({
      taskResponse: { evaluationResult: '0x00' as `0x${string}` },
    } as Partial<TaskRespondedLog['args']>)
    const result = convertLogToTaskResponse(log)

    expect(result.taskResponse.evaluationResult).toBe(false)
  })

  it('builds attestation from taskResponse and responseCertificate', () => {
    const log = createMockLog()
    const result = convertLogToTaskResponse(log)

    expect(result.attestation.taskId).toBe('0xabc123')
    expect(result.attestation.policyId).toBe('0xdef456')
    expect(result.attestation.policyClient).toBe('0x1111111111111111111111111111111111111111')
    expect(result.attestation.intentSignature).toBe('0xsig')
    expect(result.attestation.expiration).toBe(200)
  })

  it('attestation intent matches taskResponse intent', () => {
    const log = createMockLog()
    const result = convertLogToTaskResponse(log)

    expect(result.attestation.intent).toEqual(result.taskResponse.intent)
  })
})
