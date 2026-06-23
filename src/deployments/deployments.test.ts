import { describe, expect, it } from 'vitest'
import { DEPLOYMENTS, getDeployment } from './index'
import { DEPLOYMENT_KEYS, type DeploymentAddressKey, type DeploymentFile, type SupportedChainId } from './types'

const SDK_ADDRESS_KEYS = [
  'newtonProverTaskManager',
  'attestationValidator',
  'identityRegistry',
  'policyClientRegistry',
  'confidentialDataRegistry',
] as const satisfies readonly DeploymentAddressKey[]

describe('deployments', () => {
  it('resolves all SDK address keys for every supported chain', () => {
    const missing: string[] = []

    for (const chainId of Object.keys(DEPLOYMENT_KEYS) as unknown as SupportedChainId[]) {
      const deploymentKey = DEPLOYMENT_KEYS[chainId]
      const deployment = getDeployment(chainId)

      for (const addressKey of SDK_ADDRESS_KEYS) {
        if (!deployment?.addresses[addressKey]) {
          missing.push(`${deploymentKey}: missing "${addressKey}"`)
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
