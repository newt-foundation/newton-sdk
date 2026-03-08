import type { IntentFromParams } from '@core/types/task'
import { describe, expect, it } from 'vitest'
import { normalizeIntent, removeHexPrefix, sanitizeIntentForRequest } from './intent'

describe('removeHexPrefix', () => {
  it('removes 0x prefix from hex string', () => {
    expect(removeHexPrefix('0xabcdef')).toBe('abcdef')
  })

  it('returns string unchanged if no 0x prefix', () => {
    expect(removeHexPrefix('0x' as `0x${string}`)).toBe('')
  })

  it('handles empty hex value', () => {
    expect(removeHexPrefix('0x0' as `0x${string}`)).toBe('0')
  })
})

const baseIntent: IntentFromParams = {
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  value: '0x0' as `0x${string}`,
  data: '0x' as `0x${string}`,
  chainId: 11155111,
  functionSignature: '0xdeadbeef' as `0x${string}`,
}

describe('normalizeIntent', () => {
  it('converts hex value to bigint', () => {
    const intent: IntentFromParams = { ...baseIntent, value: '0xa' as `0x${string}` }
    const result = normalizeIntent(intent)
    expect(result.value).toBe(10n)
  })

  it('keeps bigint value as-is', () => {
    const intent: IntentFromParams = { ...baseIntent, value: 42n }
    const result = normalizeIntent(intent)
    expect(result.value).toBe(42n)
  })

  it('converts number chainId to bigint', () => {
    const result = normalizeIntent(baseIntent)
    expect(result.chainId).toBe(BigInt(11155111))
  })

  it('converts bigint chainId as-is', () => {
    const intent: IntentFromParams = { ...baseIntent, chainId: 1n }
    const result = normalizeIntent(intent)
    expect(result.chainId).toBe(1n)
  })

  it('converts hex chainId to bigint', () => {
    const intent: IntentFromParams = { ...baseIntent, chainId: '0x1' as `0x${string}` }
    const result = normalizeIntent(intent)
    expect(result.chainId).toBe(1n)
  })

  it('preserves from, to, data, and functionSignature', () => {
    const result = normalizeIntent(baseIntent)
    expect(result.from).toBe(baseIntent.from)
    expect(result.to).toBe(baseIntent.to)
    expect(result.data).toBe(baseIntent.data)
    expect(result.functionSignature).toBe(baseIntent.functionSignature)
  })
})

describe('sanitizeIntentForRequest', () => {
  it('converts bigint value to hex', () => {
    const intent: IntentFromParams = { ...baseIntent, value: 255n }
    const result = sanitizeIntentForRequest(intent)
    expect(result.value).toBe('0xff')
  })

  it('keeps hex value as-is', () => {
    const intent: IntentFromParams = { ...baseIntent, value: '0xff' as `0x${string}` }
    const result = sanitizeIntentForRequest(intent)
    expect(result.value).toBe('0xff')
  })

  it('converts number chainId to hex', () => {
    const result = sanitizeIntentForRequest(baseIntent)
    expect(result.chain_id).toBe('0xaa36a7') // 11155111 in hex
  })

  it('converts bigint chainId to hex', () => {
    const intent: IntentFromParams = { ...baseIntent, chainId: 1n }
    const result = sanitizeIntentForRequest(intent)
    expect(result.chain_id).toBe('0x1')
  })

  it('keeps hex chainId as-is', () => {
    const intent: IntentFromParams = { ...baseIntent, chainId: '0x1' as `0x${string}` }
    const result = sanitizeIntentForRequest(intent)
    expect(result.chain_id).toBe('0x1')
  })

  it('maps field names to snake_case for gateway', () => {
    const result = sanitizeIntentForRequest(baseIntent)
    expect(result).toHaveProperty('chain_id')
    expect(result).toHaveProperty('function_signature')
    expect(result).not.toHaveProperty('chainId')
    expect(result).not.toHaveProperty('functionSignature')
  })

  it('preserves from, to, and data', () => {
    const result = sanitizeIntentForRequest(baseIntent)
    expect(result.from).toBe(baseIntent.from)
    expect(result.to).toBe(baseIntent.to)
    expect(result.data).toBe(baseIntent.data)
  })
})
