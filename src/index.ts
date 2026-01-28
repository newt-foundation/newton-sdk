import { mainnet, sepolia, baseSepolia } from 'viem/chains';
import { Address, Hex } from 'viem';
import { SubmitEvaluationRequestParams, TaskId, TaskResponseResult, TaskStatus } from './types/task';
import {
  getTaskResponseHash,
  getTaskStatus,
  PendingTaskBuilder,
  submitEvaluationRequest,
  waitForTaskResponded,
} from './modules/avs';
import { policyReadFunctions, policyWriteFunctions } from './modules/policy';
import { NEWTON_PROVER_TASK_MANAGER, ATTESTATION_VALIDATOR } from './const';
import { popupRequest } from './service/popup';
import { NewtonIdpPayloadMethod } from './types';
import { getPayloadId } from './utils/get-payload-id';

interface SdkOverrides {
  gatewayApiUrl?: string;
  taskManagerAddress?: Address;
  attestationValidatorAddress?: Address;
  newtonIdpUrl?: string;
}

const supportedChains = [mainnet.id, sepolia.id, baseSepolia.id];

const newtonWalletClientActions =
  (config: { apiKey: string; policyContractAddress?: Address }, overrides?: SdkOverrides) => (walletClient: any) => {
    const { apiKey, policyContractAddress } = config;

    const validatePolicyContractAddress = () => {
      if (!policyContractAddress) {
        throw new Error(
          'Newton SDK: policyContractAddress is required. Ensure you instantiate viem client actions extension with policyContractAddress parameter. Example: newtonWalletClientActions({ policyContractAddress: "0x123..." })',
        );
      } else {
        return policyContractAddress;
      }
    };
    if (!supportedChains.includes(walletClient?.chain?.id ?? sepolia.id)) {
      throw new Error(
        `Newton SDK: Invalid network specified for newtonWalletClientActions. Only ${supportedChains.join(', ')} are supported`,
      );
    }
    const taskManagerAddress =
      overrides?.taskManagerAddress ?? NEWTON_PROVER_TASK_MANAGER[walletClient?.chain?.id ?? sepolia.id];

    const gatewayApiUrlOverride = overrides?.gatewayApiUrl ?? undefined;

    const idpUrl = overrides?.newtonIdpUrl ?? 'https://persona-kyc-nextjs.vercel.app';

    return {
      submitEvaluationRequest: (
        args: SubmitEvaluationRequestParams,
      ): Promise<{ result: { taskId: Hex; txHash: Hex } } & PendingTaskBuilder> =>
        submitEvaluationRequest(walletClient, args, taskManagerAddress, apiKey, gatewayApiUrlOverride),

      initialize: (args: {
        factory: Address;
        entrypoint: string;
        policyCid: string;
        schemaCid: string;
        policyData: Address[];
        metadataCid: string;
        owner: Address;
      }): Promise<`0x${string}`> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyWriteFunctions.initialize({ walletClient, policyContractAddress: validatedAddress, ...args });
      },

      renounceOwnership: (): Promise<`0x${string}`> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyWriteFunctions.renounceOwnership({ walletClient, policyContractAddress: validatedAddress });
      },

      transferOwnership: (args: { newOwner: Address }): Promise<`0x${string}`> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyWriteFunctions.transferOwnership({
          walletClient,
          policyContractAddress: validatedAddress,
          ...args,
        });
      },

      connectIdentityWithNewton: (args: { appWalletAddress: Address; appClientAddress: Address }): Promise<any> => {
        return popupRequest(
          {
            method: NewtonIdpPayloadMethod.Connect,
            id: getPayloadId(),
            params: { apiKey, appWalletAddress: args.appWalletAddress, appClientAddress: args.appClientAddress },
          },
          idpUrl,
        );
      },

      unlinkApp: (args: { appWalletAddress: Address; appClientAddress: Address }): Promise<any> => {
        return popupRequest(
          {
            method: NewtonIdpPayloadMethod.Unlink,
            id: getPayloadId(),
            params: { apiKey, appWalletAddress: args.appWalletAddress, appClientAddress: args.appClientAddress },
          },
          idpUrl,
        );
      },
    };
  };

const newtonPublicClientActions =
  (options?: { policyContractAddress?: Address }, overrides?: SdkOverrides) => (publicClient: any) => {
    if (publicClient?.chain?.id !== mainnet.id && publicClient?.chain?.id !== sepolia.id) {
      throw new Error(
        'Newton SDK: Invalid network specified for newtonPublicActions. Only mainnet and sepolia are supported',
      );
    }

    const policyContractAddress = options?.policyContractAddress;
    const validatePolicyContractAddress = () => {
      if (!policyContractAddress) {
        throw new Error(
          'Newton SDK: policyContractAddress is required. Ensure you instantiate viem client actions extension with policyContractAddress parameter. Example: newtonPublicClientActions({ policyContractAddress: "0x123..." })',
        );
      }
      return policyContractAddress;
    };

    const taskManagerAddress =
      overrides?.taskManagerAddress ?? NEWTON_PROVER_TASK_MANAGER[publicClient?.chain?.id ?? sepolia.id];

    const attestationValidatorAddress =
      overrides?.attestationValidatorAddress ?? ATTESTATION_VALIDATOR[publicClient?.chain?.id ?? sepolia.id];

    return {
      // AVS module functions
      waitForTaskResponded: (args: {
        taskId: TaskId;
        timeoutMs?: number; // may be short (< 1s) in fast paths
        abortSignal?: AbortSignal;
      }): Promise<TaskResponseResult> => waitForTaskResponded(publicClient, args, taskManagerAddress),

      getTaskResponseHash: (args: { taskId: TaskId }): Promise<Hex | null> =>
        getTaskResponseHash(publicClient, args, taskManagerAddress),

      getTaskStatus: (args: { taskId: TaskId }): Promise<TaskStatus> =>
        getTaskStatus(publicClient, args, taskManagerAddress, attestationValidatorAddress),

      // Policy read functions

      clientToPolicyId: (args: { client: Address }): Promise<`0x${string}`> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.clientToPolicyId({ publicClient, policyContractAddress: validatedAddress, ...args });
      },

      entrypoint: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.entrypoint({ publicClient, policyContractAddress: validatedAddress });
      },

      factory: (): Promise<Address> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.factory({ publicClient, policyContractAddress: validatedAddress });
      },

      getEntrypoint: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.getEntrypoint({ publicClient, policyContractAddress: validatedAddress });
      },

      getMetadataCid: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.getMetadataCid({ publicClient, policyContractAddress: validatedAddress });
      },

      getPolicyCid: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.getPolicyCid({ publicClient, policyContractAddress: validatedAddress });
      },

      getPolicyConfig: (args: {
        policyId: `0x${string}`;
      }): Promise<{ policyParams: string | object; policyParamsHex: `0x${string}`; expireAfter: number }> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.getPolicyConfig({ publicClient, policyContractAddress: validatedAddress, ...args });
      },

      getPolicyData: (): Promise<Address[]> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.getPolicyData({ publicClient, policyContractAddress: validatedAddress });
      },

      getPolicyId: (args: { client: Address }): Promise<`0x${string}`> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.getPolicyId({ publicClient, policyContractAddress: validatedAddress, ...args });
      },

      getSchemaCid: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.getSchemaCid({ publicClient, policyContractAddress: validatedAddress });
      },

      isPolicyVerified: (): Promise<boolean> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.isPolicyVerified({ publicClient, policyContractAddress: validatedAddress });
      },

      metadataCid: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.metadataCid({ publicClient, policyContractAddress: validatedAddress });
      },

      owner: (): Promise<Address> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.owner({ publicClient, policyContractAddress: validatedAddress });
      },

      policyCid: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.policyCid({ publicClient, policyContractAddress: validatedAddress });
      },

      policyData: (args: { index: number }): Promise<Address> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.policyData({ publicClient, policyContractAddress: validatedAddress, ...args });
      },

      schemaCid: (): Promise<string> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.schemaCid({ publicClient, policyContractAddress: validatedAddress });
      },

      supportsInterface: (args: { interfaceId: `0x${string}` }): Promise<boolean> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.supportsInterface({
          publicClient,
          policyContractAddress: validatedAddress,
          ...args,
        });
      },

      // SDK utility function
      precomputePolicyId: (args: {
        policyContract: Address;
        policyData: Address[];
        params: any; // PolicyParamsJson
        client: Address;
        policyUri: string;
        schemaUri: string;
        entrypoint: string;
        expireAfter?: number;
        blockTimestamp?: bigint;
      }) => {
        const validatedAddress = validatePolicyContractAddress();
        return policyReadFunctions.precomputePolicyId({
          publicClient,
          policyContractAddress: validatedAddress,
          ...args,
        });
      },
    };
  };

export { newtonPublicClientActions, newtonWalletClientActions };
