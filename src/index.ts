import { mainnet, sepolia } from 'viem/chains';
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

const newtonWalletClientActions =
  (options?: { policyContractAddress?: Address; publicClient?: any }) => (walletClient: any) => {
    const policyContractAddress = options?.policyContractAddress;

    const validatePolicyContractAddress = () => {
      if (!policyContractAddress) {
        throw new Error(
          'Newton SDK: policyContractAddress is required. Ensure you instantiate viem client actions extension with policyContractAddress parameter. Example: newtonWalletClientActions({ policyContractAddress: "0x123..." })',
        );
      } else {
        return policyContractAddress;
      }
    };
    if (walletClient?.chain?.id !== mainnet.id && walletClient?.chain?.id !== sepolia.id) {
      throw new Error(
        'Newton SDK: Invalid network specified for newtonWalletClientActions. Only mainnet and sepolia are supported',
      );
    }
    return {
      submitEvaluationRequest: (
        args: SubmitEvaluationRequestParams,
      ): Promise<{ result: { taskId: Hex; txHash: Hex } } & PendingTaskBuilder> =>
        submitEvaluationRequest(walletClient, args),

      // Policy write functions
      setPolicy: (args: { policyConfig: { policyParams: object; expireAfter: number } }): Promise<`0x${string}`> => {
        const validatedAddress = validatePolicyContractAddress();
        return policyWriteFunctions.setPolicy({ walletClient, policyContractAddress: validatedAddress, ...args });
      },

      initialize: (args: {
        factory: Address;
        entrypoint: string;
        policyUri: string;
        schemaUri: string;
        policyData: Address[];
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
    };
  };

const newtonPublicClientActions = (options?: { policyContractAddress?: Address }) => (publicClient: any) => {
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

  return {
    // AVS module functions
    waitForTaskResponded: (args: {
      taskId: TaskId;
      timeoutMs?: number; // may be short (< 1s) in fast paths
      abortSignal?: AbortSignal;
    }): Promise<TaskResponseResult> => waitForTaskResponded(publicClient, args),

    getTaskResponseHash: (args: { taskId: TaskId }): Promise<Hex | null> => getTaskResponseHash(publicClient, args),

    getTaskStatus: (args: { taskId: TaskId }): Promise<TaskStatus> => getTaskStatus(publicClient, args),

    // Policy read functions
    policyUri: (): Promise<string> => {
      const validatedAddress = validatePolicyContractAddress();
      return policyReadFunctions.policyUri({ publicClient, policyContractAddress: validatedAddress });
    },

    getPolicyData: (): Promise<Address[]> => {
      const validatedAddress = validatePolicyContractAddress();
      return policyReadFunctions.getPolicyData({ publicClient, policyContractAddress: validatedAddress });
    },

    getPolicyUri: (): Promise<string> => {
      const validatedAddress = validatePolicyContractAddress();
      return policyReadFunctions.getPolicyUri({ publicClient, policyContractAddress: validatedAddress });
    },

    getSchemaUri: (): Promise<string> => {
      const validatedAddress = validatePolicyContractAddress();
      return policyReadFunctions.getSchemaUri({ publicClient, policyContractAddress: validatedAddress });
    },

    getEntrypoint: (): Promise<string> => {
      const validatedAddress = validatePolicyContractAddress();
      return policyReadFunctions.getEntrypoint({ publicClient, policyContractAddress: validatedAddress });
    },

    getPolicyId: (args: { client: Address }): Promise<`0x${string}`> => {
      const validatedAddress = validatePolicyContractAddress();
      return policyReadFunctions.getPolicyId({ publicClient, policyContractAddress: validatedAddress, ...args });
    },

    getPolicyConfig: (args: {
      policyId: `0x${string}`;
    }): Promise<{ policyParams: object; policyParamsHex: `0x${string}`; expireAfter: number }> => {
      const validatedAddress = validatePolicyContractAddress();
      return policyReadFunctions.getPolicyConfig({ publicClient, policyContractAddress: validatedAddress, ...args });
    },

    supportsInterface: (args: { interfaceId: `0x${string}` }): Promise<boolean> => {
      const validatedAddress = validatePolicyContractAddress();
      return policyReadFunctions.supportsInterface({ publicClient, policyContractAddress: validatedAddress, ...args });
    },

    owner: (): Promise<Address> => {
      const validatedAddress = validatePolicyContractAddress();
      return policyReadFunctions.owner({ publicClient, policyContractAddress: validatedAddress });
    },

    factory: (): Promise<Address> => {
      const validatedAddress = validatePolicyContractAddress();
      return policyReadFunctions.factory({ publicClient, policyContractAddress: validatedAddress });
    },

    entrypoint: (): Promise<string> => {
      const validatedAddress = validatePolicyContractAddress();
      return policyReadFunctions.entrypoint({ publicClient, policyContractAddress: validatedAddress });
    },

    schemaUri: (): Promise<string> => {
      const validatedAddress = validatePolicyContractAddress();
      return policyReadFunctions.schemaUri({ publicClient, policyContractAddress: validatedAddress });
    },

    clientToPolicyId: (args: { client: Address }): Promise<`0x${string}`> => {
      const validatedAddress = validatePolicyContractAddress();
      return policyReadFunctions.clientToPolicyId({ publicClient, policyContractAddress: validatedAddress, ...args });
    },

    policyData: (args: { index: number }): Promise<Address> => {
      const validatedAddress = validatePolicyContractAddress();
      return policyReadFunctions.policyData({ publicClient, policyContractAddress: validatedAddress, ...args });
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
      return policyReadFunctions.precomputePolicyId({ publicClient, policyContractAddress: validatedAddress, ...args });
    },
  };
};

export { newtonPublicClientActions, newtonWalletClientActions };
