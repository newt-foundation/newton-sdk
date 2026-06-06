import type { TaskRespondedLog } from '@core/abis/newtonAbi'
import { describe, expect, it } from 'vitest'
import { convertLogToTaskResponse } from './task'

function createMockLog(overrides?: {
  taskResponse?: Partial<TaskRespondedLog['args']['taskResponse']>
  responseCertificate?: Partial<TaskRespondedLog['args']['responseCertificate']>
}): TaskRespondedLog {
  return {
    address: '0x0000000000000000000000000000000000000000',
    blockHash: '0xblock',
    blockNumber: 1n,
    data: '0x',
    logIndex: 0,
    transactionHash: '0xtx',
    transactionIndex: 0,
    removed: false,
    topics: [],
    eventName: 'TaskResponded',
    args: {
      taskResponse: {
        taskId: '0xabc123',
        policyClient: '0x1111111111111111111111111111111111111111',
        policyId: '0xdef456',
        policyAddress: '0x2222222222222222222222222222222222222222',
        intent: {
          from: '0x3333333333333333333333333333333333333333',
          to: '0x4444444444444444444444444444444444444444',
          value: 1000n,
          data: '0x',
          chainId: 11155111n,
          functionSignature: '0xdeadbeef',
        },
        intentSignature: '0xsig',
        evaluationResult: '0x01',
        policyTaskData: {
          policyId: '0xdef456',
          policyAddress: '0x2222222222222222222222222222222222222222',
          policy: '0x',
          policyData: [],
          policyConfig: {
            policyParams: '0x',
            expireAfter: 0,
          },
        },
        initializationTimestamp: 0n,
        ...overrides?.taskResponse,
      },
      responseCertificate: {
        referenceBlock: 100,
        responseExpireBlock: 200,
        hashOfNonSigners: '0xhash',
        signatureData: '0x',
        ...overrides?.responseCertificate,
      },
    },
  } as unknown as TaskRespondedLog
}

describe('convertLogToTaskResponse', () => {
  it('converts intent value and chainId to bigint', () => {
    const log = createMockLog()
    const result = convertLogToTaskResponse(log)

    expect(result.taskResponse.intent.value).toBe(1000n)
    expect(result.taskResponse.intent.chainId).toBe(11155111n)
  })

  it('maps responseCertificate.referenceBlock to taskResponsedBlock', () => {
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
      taskResponse: { evaluationResult: '0x00' },
    })
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
