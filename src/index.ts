import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { baseSepolia, mainnet, sepolia } from 'viem/chains'
import {
  type PendingTaskBuilder,
  evaluateIntentDirect,
  getTaskResponseHash,
  getTaskStatus,
  simulatePolicy,
  simulatePolicyData,
  simulatePolicyDataWithClient,
  simulateTask,
  submitEvaluationRequest,
  submitIntentAndSubscribe,
  waitForTaskResponded,
} from './modules/avs'
import { identityDomainHash, sendIdentityEncrypted } from './modules/identity'
import { policyReadFunctions, policyWriteFunctions } from './modules/policy'
import {
  createSecureEnvelope,
  generateSigningKeyPair,
  getPrivacyPublicKey,
  signPrivacyAuthorization,
  storeEncryptedSecrets,
  uploadEncryptedData,
  uploadSecureEnvelope,
} from './modules/privacy'
import type { SendIdentityEncryptedParams, SendIdentityEncryptedResponse } from './types/identity'
import type { PolicyParamsJson } from './types/policy'
import type {
  CreateSecureEnvelopeParams,
  Ed25519KeyPair,
  PrivacyAuthorizationResult,
  PrivacyPublicKeyResponse,
  SecureEnvelopeResult,
  SignPrivacyAuthorizationParams,
  StoreEncryptedSecretsParams,
  StoreEncryptedSecretsResponse,
  UploadEncryptedDataParams,
  UploadEncryptedDataResponse,
  UploadSecureEnvelopeParams,
} from './types/privacy'
import type {
  SimulatePolicyDataParams,
  SimulatePolicyDataResult,
  SimulatePolicyDataWithClientParams,
  SimulatePolicyDataWithClientResult,
  SimulatePolicyParams,
  SimulatePolicyResult,
  SimulateTaskParams,
  SimulateTaskResult,
  SubmitEvaluationRequestParams,
  SubmitIntentResult,
  Task,
  TaskId,
  TaskResponseResult,
  TaskStatus,
} from './types/task'

import { ATTESTATION_VALIDATOR, NEWTON_PROVER_TASK_MANAGER } from './const'
import { popupRequest } from './service/popup'
import { NewtonIdpPayloadMethod } from './types'
import type { KycUserData } from './types/identity'
import { getPayloadId } from './utils/get-payload-id'

interface SdkOverrides {
  gatewayApiUrl?: string
  taskManagerAddress?: Address
  attestationValidatorAddress?: Address
  newtonIdpUrl?: string
  identityRegistry?: Address
}

const supportedChains: number[] = [mainnet.id, sepolia.id, baseSepolia.id]

const newtonWalletClientActions =
  (config: { apiKey: string; policyContractAddress?: Address }, overrides?: SdkOverrides) =>
  (walletClient: WalletClient) => {
    const { apiKey, policyContractAddress } = config

    const validatePolicyContractAddress = () => {
      if (!policyContractAddress) {
        throw new Error(
          'Newton SDK: policyContractAddress is required. Ensure you instantiate viem client actions extension with policyContractAddress parameter. Example: newtonWalletClientActions({ policyContractAddress: "0x123..." })',
        )
      }
      return policyContractAddress
    }
    if (!supportedChains.includes(walletClient?.chain?.id ?? sepolia.id)) {
      throw new Error(
        `Newton SDK: Invalid network specified for newtonWalletClientActions. Only ${supportedChains.join(', ')} are supported`,
      )
    }
    const taskManagerAddress =
      overrides?.taskManagerAddress ?? NEWTON_PROVER_TASK_MANAGER[walletClient?.chain?.id ?? sepolia.id]

    const gatewayApiUrlOverride = overrides?.gatewayApiUrl ?? undefined

    const idpUrl = overrides?.newtonIdpUrl

    const identityRegistryOverride = overrides?.identityRegistry ?? undefined

    return {
      submitEvaluationRequest: (
        args: SubmitEvaluationRequestParams,
      ): Promise<{ result: { taskId: Hex; txHash: Hex } } & PendingTaskBuilder> =>
        submitEvaluationRequest(walletClient, args, taskManagerAddress, apiKey, gatewayApiUrlOverride),

      evaluateIntentDirect: (
        args: SubmitEvaluationRequestParams,
      ): Promise<{
        result: {
          evaluationResult: boolean
          task: Task
          taskResponse: unknown
          blsSignature: unknown
        }
      }> => evaluateIntentDirect(walletClient, args, apiKey, gatewayApiUrlOverride),

      submitIntentAndSubscribe: (
        args: SubmitEvaluationRequestParams,
      ): Promise<{ result: SubmitIntentResult; ws: WebSocket }> =>
        submitIntentAndSubscribe(walletClient, args, apiKey, gatewayApiUrlOverride),
      simulateTask: (args: SimulateTaskParams): Promise<SimulateTaskResult> =>
        simulateTask(walletClient, args, apiKey, gatewayApiUrlOverride),

      simulatePolicy: (args: SimulatePolicyParams): Promise<SimulatePolicyResult> =>
        simulatePolicy(walletClient, args, apiKey, gatewayApiUrlOverride),

      simulatePolicyData: (args: SimulatePolicyDataParams): Promise<SimulatePolicyDataResult> =>
        simulatePolicyData(walletClient, args, apiKey, gatewayApiUrlOverride),

      simulatePolicyDataWithClient: (
        args: SimulatePolicyDataWithClientParams,
      ): Promise<SimulatePolicyDataWithClientResult> =>
        simulatePolicyDataWithClient(walletClient, args, apiKey, gatewayApiUrlOverride),

      initialize: (args: {
        factory: Address
        entrypoint: string
        policyCid: string
        schemaCid: string
        policyData: Address[]
        metadataCid: string
        owner: Address
      }): Promise<`0x${string}`> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyWriteFunctions.initialize({
          walletClient,
          policyContractAddress: validatedAddress,
          ...args,
        })
      },

      renounceOwnership: (): Promise<`0x${string}`> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyWriteFunctions.renounceOwnership({
          walletClient,
          policyContractAddress: validatedAddress,
        })
      },

      transferOwnership: (args: {
        newOwner: Address
      }): Promise<`0x${string}`> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyWriteFunctions.transferOwnership({
          walletClient,
          policyContractAddress: validatedAddress,
          ...args,
        })
      },

      connectIdentityWithNewton: (args: {
        appWalletAddress: Address
        appClientAddress: Address
      }): Promise<unknown> => {
        return popupRequest(
          {
            method: NewtonIdpPayloadMethod.Connect,
            id: getPayloadId(),
            jsonrpc: '2.0',
            params: {
              apiKey,
              chainId: walletClient.chain?.id,
              appWalletAddress: args.appWalletAddress,
              appClientAddress: args.appClientAddress,
            },
          },
          idpUrl,
        )
      },

      registerUserData: (args: {
        userData: KycUserData
        appIdentityDomain: Hex
      }): Promise<unknown> => {
        return popupRequest(
          {
            method: NewtonIdpPayloadMethod.RegisterUserData,
            id: getPayloadId(),
            jsonrpc: '2.0',
            params: {
              apiKey,
              userData: args.userData,
              gatewayApiUrlOverride,
              chainId: walletClient.chain?.id,
              appIdentityDomain: args.appIdentityDomain,
              identityRegistryOverride,
            },
          },
          idpUrl,
        )
      },

      linkApp: (args: {
        appWalletAddress: Address
        appClientAddress: Address
        appIdentityDomain: Hex
      }): Promise<unknown> => {
        return popupRequest(
          {
            method: NewtonIdpPayloadMethod.LinkApp,
            id: getPayloadId(),
            jsonrpc: '2.0',
            params: {
              apiKey,
              appWalletAddress: args.appWalletAddress,
              appClientAddress: args.appClientAddress,
              appIdentityDomain: args.appIdentityDomain,
              chainId: walletClient.chain?.id,
              identityRegistryOverride,
            },
          },
          idpUrl,
        )
      },

      unlinkApp: (args: {
        appWalletAddress: Address
        appClientAddress: Address
        appIdentityDomain: Hex
      }): Promise<unknown> => {
        return popupRequest(
          {
            method: NewtonIdpPayloadMethod.Unlink,
            id: getPayloadId(),
            jsonrpc: '2.0',
            params: {
              apiKey,
              appWalletAddress: args.appWalletAddress,
              appClientAddress: args.appClientAddress,
              chainId: walletClient.chain?.id,
              appIdentityDomain: args.appIdentityDomain,
              identityRegistryOverride,
            },
          },
          idpUrl,
        )
      },
      // Privacy module functions
      getPrivacyPublicKey: (): Promise<PrivacyPublicKeyResponse> =>
        getPrivacyPublicKey(walletClient?.chain?.id ?? sepolia.id, apiKey, gatewayApiUrlOverride),

      createSecureEnvelope: (args: CreateSecureEnvelopeParams, signingKey: Uint8Array): Promise<SecureEnvelopeResult> =>
        createSecureEnvelope(args, signingKey),

      uploadEncryptedData: (args: UploadEncryptedDataParams): Promise<UploadEncryptedDataResponse> =>
        uploadEncryptedData(walletClient?.chain?.id ?? sepolia.id, apiKey, args, gatewayApiUrlOverride),

      uploadSecureEnvelope: (args: UploadSecureEnvelopeParams): Promise<UploadEncryptedDataResponse> =>
        uploadSecureEnvelope(walletClient?.chain?.id ?? sepolia.id, apiKey, args, gatewayApiUrlOverride),

      generateSigningKeyPair: (): Ed25519KeyPair => generateSigningKeyPair(),

      storeEncryptedSecrets: (args: StoreEncryptedSecretsParams): Promise<StoreEncryptedSecretsResponse> =>
        storeEncryptedSecrets(walletClient?.chain?.id ?? sepolia.id, apiKey, args, gatewayApiUrlOverride),

      signPrivacyAuthorization: (args: SignPrivacyAuthorizationParams): PrivacyAuthorizationResult =>
        signPrivacyAuthorization(args),

      sendIdentityEncrypted: (args: SendIdentityEncryptedParams): Promise<SendIdentityEncryptedResponse> =>
        sendIdentityEncrypted(walletClient, args, apiKey, gatewayApiUrlOverride),
    }
  }

const newtonPublicClientActions =
  (options?: { policyContractAddress?: Address }, overrides?: SdkOverrides) => (publicClient: PublicClient) => {
    if (!supportedChains.includes(publicClient?.chain?.id ?? sepolia.id)) {
      throw new Error(
        `Newton SDK: Invalid network specified for newtonPublicActions. Only ${supportedChains.join(', ')} are supported.`,
      )
    }

    const policyContractAddress = options?.policyContractAddress
    const validatePolicyContractAddress = () => {
      if (!policyContractAddress) {
        throw new Error(
          'Newton SDK: policyContractAddress is required. Ensure you instantiate viem client actions extension with policyContractAddress parameter. Example: newtonPublicClientActions({ policyContractAddress: "0x123..." })',
        )
      }
      return policyContractAddress
    }

    const taskManagerAddress =
      overrides?.taskManagerAddress ?? NEWTON_PROVER_TASK_MANAGER[publicClient?.chain?.id ?? sepolia.id]

    const attestationValidatorAddress =
      overrides?.attestationValidatorAddress ?? ATTESTATION_VALIDATOR[publicClient?.chain?.id ?? sepolia.id]

    return {
      // AVS module functions
      waitForTaskResponded: (args: {
        taskId: TaskId
        timeoutMs?: number // may be short (< 1s) in fast paths
        abortSignal?: AbortSignal
      }): Promise<TaskResponseResult> => waitForTaskResponded(publicClient, args, taskManagerAddress),

      getTaskResponseHash: (args: { taskId: TaskId }): Promise<Hex | null> =>
        getTaskResponseHash(publicClient, args, taskManagerAddress),

      getTaskStatus: (args: { taskId: TaskId }): Promise<TaskStatus> =>
        getTaskStatus(publicClient, args, taskManagerAddress, attestationValidatorAddress),

      // Policy read functions

      clientToPolicyId: (args: { client: Address }): Promise<`0x${string}`> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.clientToPolicyId({
          publicClient,
          policyContractAddress: validatedAddress,
          ...args,
        })
      },

      entrypoint: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.entrypoint({
          publicClient,
          policyContractAddress: validatedAddress,
        })
      },

      factory: (): Promise<Address> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.factory({
          publicClient,
          policyContractAddress: validatedAddress,
        })
      },

      getEntrypoint: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.getEntrypoint({
          publicClient,
          policyContractAddress: validatedAddress,
        })
      },

      getMetadataCid: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.getMetadataCid({
          publicClient,
          policyContractAddress: validatedAddress,
        })
      },

      getPolicyCid: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.getPolicyCid({
          publicClient,
          policyContractAddress: validatedAddress,
        })
      },

      getPolicyConfig: (args: {
        policyId: `0x${string}`
      }): Promise<{
        policyParams: string | object
        policyParamsHex: `0x${string}`
        expireAfter: number
      }> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.getPolicyConfig({
          publicClient,
          policyContractAddress: validatedAddress,
          ...args,
        })
      },

      getPolicyData: (): Promise<Address[]> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.getPolicyData({
          publicClient,
          policyContractAddress: validatedAddress,
        })
      },

      getPolicyId: (args: { client: Address }): Promise<`0x${string}`> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.getPolicyId({
          publicClient,
          policyContractAddress: validatedAddress,
          ...args,
        })
      },

      getSchemaCid: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.getSchemaCid({
          publicClient,
          policyContractAddress: validatedAddress,
        })
      },

      isPolicyVerified: (): Promise<boolean> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.isPolicyVerified({
          publicClient,
          policyContractAddress: validatedAddress,
        })
      },

      metadataCid: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.metadataCid({
          publicClient,
          policyContractAddress: validatedAddress,
        })
      },

      owner: (): Promise<Address> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.owner({
          publicClient,
          policyContractAddress: validatedAddress,
        })
      },

      policyCid: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.policyCid({
          publicClient,
          policyContractAddress: validatedAddress,
        })
      },

      policyData: (args: { index: number }): Promise<Address> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.policyData({
          publicClient,
          policyContractAddress: validatedAddress,
          ...args,
        })
      },

      schemaCid: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.schemaCid({
          publicClient,
          policyContractAddress: validatedAddress,
        })
      },

      supportsInterface: (args: {
        interfaceId: `0x${string}`
      }): Promise<boolean> => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.supportsInterface({
          publicClient,
          policyContractAddress: validatedAddress,
          ...args,
        })
      },

      // SDK utility function
      precomputePolicyId: (args: {
        policyContract: Address
        policyData: Address[]
        params: PolicyParamsJson
        client: Address
        policyUri: string
        schemaUri: string
        entrypoint: string
        expireAfter?: number
        blockTimestamp?: bigint
      }) => {
        const validatedAddress = validatePolicyContractAddress()
        return policyReadFunctions.precomputePolicyId({
          publicClient,
          policyContractAddress: validatedAddress,
          ...args,
        })
      },
    }
  }

export { newtonPublicClientActions, newtonWalletClientActions }
export { identityDomainHash, sendIdentityEncrypted }
export {
  createSecureEnvelope,
  generateSigningKeyPair,
  getPrivacyPublicKey,
  signPrivacyAuthorization,
  storeEncryptedSecrets,
  uploadEncryptedData,
  uploadSecureEnvelope,
}
