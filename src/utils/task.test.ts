import type { TaskRespondedLog } from '@core/abis/newtonAbi'
import { describe, expect, it } from 'vitest'
import { convertLogToTaskResponse } from './task'

const POLICY_A = '0x2222222222222222222222222222222222222222'
const POLICY_B = '0x5555555555555555555555555555555555555555'

function policyTaskData(policyAddress: string, policyId: string) {
  return {
    policyId,
    policyAddress,
    policy: '0x',
    policyData: [],
  }
}

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
        intent: {
          from: '0x3333333333333333333333333333333333333333',
          to: '0x4444444444444444444444444444444444444444',
          value: 1000n,
          data: '0x',
          chainId: 11155111n,
          functionSignature: '0xdeadbeef',
        },
        intentSignature: '0xsig',
        allowed: true,
        policyTaskData: [policyTaskData(POLICY_A, '0xdef456')],
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
    const result = convertLogToTaskResponse(createMockLog())

    expect(result.taskResponse.intent.value).toBe(1000n)
    expect(result.taskResponse.intent.chainId).toBe(11155111n)
  })

  it('maps responseCertificate.referenceBlock to taskResponsedBlock', () => {
    const result = convertLogToTaskResponse(createMockLog())

    expect(result.responseCertificate.taskResponsedBlock).toBe(100)
    expect(result.responseCertificate.responseExpireBlock).toBe(200)
  })

  it('carries allowed through unchanged', () => {
    expect(convertLogToTaskResponse(createMockLog()).taskResponse.allowed).toBe(true)
    expect(
      convertLogToTaskResponse(createMockLog({ taskResponse: { allowed: false } as never })).taskResponse.allowed,
    ).toBe(false)
  })

  it('preserves policyTaskData order', () => {
    const log = createMockLog({
      taskResponse: {
        policyTaskData: [
          policyTaskData(POLICY_B, '0xb'),
          policyTaskData(POLICY_A, '0xa'),
          policyTaskData(POLICY_B, '0xb'),
        ],
      } as never,
    })
    const result = convertLogToTaskResponse(log)

    expect(result.taskResponse.policyTaskData.map(p => p.policyAddress)).toEqual([POLICY_B, POLICY_A, POLICY_B])
  })

  it('keeps repeated policies distinct rather than collapsing them', () => {
    const log = createMockLog({
      taskResponse: {
        policyTaskData: [policyTaskData(POLICY_A, '0xa'), policyTaskData(POLICY_A, '0xa')],
      } as never,
    })
    const result = convertLogToTaskResponse(log)

    expect(result.taskResponse.policyTaskData).toHaveLength(2)
  })

  it('builds attestation from taskResponse and responseCertificate', () => {
    const result = convertLogToTaskResponse(createMockLog())

    expect(result.attestation.taskId).toBe('0xabc123')
    expect(result.attestation.policyId).toBe('0xdef456')
    expect(result.attestation.policyClient).toBe('0x1111111111111111111111111111111111111111')
    expect(result.attestation.intentSignature).toBe('0xsig')
    expect(result.attestation.expiration).toBe(200)
  })

  it('attestation intent matches taskResponse intent', () => {
    const result = convertLogToTaskResponse(createMockLog())

    expect(result.attestation.intent).toEqual(result.taskResponse.intent)
  })
})
