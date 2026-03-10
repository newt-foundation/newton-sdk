import { describe, expect, it } from 'vitest'
import { AvsHttpService } from './https'

describe('AvsHttpService', () => {
  it('resolves gateway URL from chain ID', () => {
    const service = new AvsHttpService(11155111) // sepolia
    expect(service.baseUrl).toBe('https://gateway.testnet.newton.xyz/rpc')
  })

  it('resolves mainnet gateway URL', () => {
    const service = new AvsHttpService(1) // mainnet
    expect(service.baseUrl).toBe('https://gateway.newton.xyz/rpc')
  })

  it('uses URL override when provided', () => {
    const override = 'https://custom-gateway.example.com/rpc'
    const service = new AvsHttpService(11155111, override)
    expect(service.baseUrl).toBe(override)
  })

  it('returns undefined for unsupported chain ID without override', () => {
    const service = new AvsHttpService(999999)
    expect(service.baseUrl).toBeUndefined()
  })
})
