import { describe, expect, it } from 'vitest'
import { DEPLOYMENTS, getDeployment } from './index'
import {
  DEPLOYMENT_KEYS,
  type DeploymentAddressKey,
  type DeploymentFile,
  type SupportedChainId,
  asDeploymentAddress,
} from './types'

const SDK_ADDRESS_KEYS = [
  'newtonProverTaskManager',
  'attestationValidator',
  'identityRegistry',
  'policyClientRegistry',
  'confidentialDataRegistry',
] as const satisfies readonly DeploymentAddressKey[]

describe('deployments', () => {
  it('rejects missing and malformed deployment addresses', () => {
    const validAddressHex = 'a'.repeat(40)
    const validAddress = `0x${validAddressHex}`

    expect(() => asDeploymentAddress(undefined, 1, 'identityRegistry')).toThrow(
      'Missing deployment address "identityRegistry" for chain 1',
    )
    expect(() => asDeploymentAddress('abc', 1, 'identityRegistry')).toThrow(
      'Invalid deployment address "identityRegistry" for chain 1: "abc"',
    )
    expect(() => asDeploymentAddress('0x1234', 1, 'identityRegistry')).toThrow(
      'Invalid deployment address "identityRegistry" for chain 1: "0x1234"',
    )
    expect(() => asDeploymentAddress(` 0x${validAddressHex}`, 1, 'identityRegistry')).toThrow(
      'Invalid deployment address "identityRegistry" for chain 1',
    )
    expect(asDeploymentAddress(validAddress, 1, 'identityRegistry')).toBe(validAddress)
  })

  it('resolves all SDK address keys for every supported chain', () => {
    const missing: string[] = []

    for (const chainIdKey in DEPLOYMENT_KEYS) {
      const chainId = Number(chainIdKey) as SupportedChainId
      const deploymentKey = DEPLOYMENT_KEYS[chainId]
      const deployment = getDeployment(chainId)

      for (const addressKey of SDK_ADDRESS_KEYS) {
        try {
          asDeploymentAddress(deployment?.addresses[addressKey], chainId, addressKey)
        } catch (error) {
          missing.push(`${deploymentKey}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }

    expect(missing, `Incomplete deployment files:\n${missing.join('\n')}`).toEqual([])
  })

  it('does not require source-only cross-chain files to carry SDK address keys', () => {
    const sourceOnly = DEPLOYMENTS['newton-cross-chain/1-prod'] as DeploymentFile
    for (const addressKey of SDK_ADDRESS_KEYS) {
      expect(sourceOnly.addresses[addressKey]).toBeUndefined()
    }
  })
})
