import { mainnet, sepolia } from 'viem/chains';
import { Address, createPublicClient, Hex, http } from 'viem';
import { CreateTaskParams, TaskId, TaskResponse, TaskStatus } from './types/task';
import {
  getTaskResponseHash,
  getTaskStatus,
  PendingTaskBuilder,
  submitEvaluationRequest,
  waitForTaskResponded,
} from './modules/avs';
import { policyReadFunctions, policyWriteFunctions } from './modules/policy';

const newtonWalletClientActions = (publicClient?: any) => (walletClient: any) => {
  if (walletClient?.chain?.id !== mainnet.id && walletClient?.chain?.id !== sepolia.id) {
    throw new Error(
      'Newton SDK: Invalid network specified for newtonWalletClientActions. Only mainnet and sepolia are supported',
    );
  }
  return {
    submitEvaluationRequest: (args: CreateTaskParams): Promise<{ result: unknown } & PendingTaskBuilder> =>
      submitEvaluationRequest(
        publicClient ?? createPublicClient({ chain: walletClient.chain, transport: http() }),
        walletClient,
        args,
      ),

    // Policy write functions
    setPolicy: (args: { policyConfig: { policyParams: `0x${string}`; expireAfter: number } }): Promise<`0x${string}`> =>
      policyWriteFunctions.setPolicy(walletClient, args),

    initialize: (args: {
      factory: Address;
      entrypoint: string;
      policyUri: string;
      schemaUri: string;
      policyData: Address[];
    }): Promise<`0x${string}`> => policyWriteFunctions.initialize(walletClient, args),

    renounceOwnership: (): Promise<`0x${string}`> => policyWriteFunctions.renounceOwnership(walletClient),

    transferOwnership: (args: { newOwner: Address }): Promise<`0x${string}`> =>
      policyWriteFunctions.transferOwnership(walletClient, args),
  };
};

const newtonPublicClientActions = () => (publicClient: any) => {
  if (publicClient?.chain?.id !== mainnet.id && publicClient?.chain?.id !== sepolia.id) {
    throw new Error(
      'Newton SDK: Invalid network specified for newtonPublicActions. Only mainnet and sepolia are supported',
    );
  }
  return {
    // AVS module functions
    waitForTaskResponded: (args: {
      taskId: TaskId;
      timeoutMs?: number; // may be short (< 1s) in fast paths
      abortSignal?: AbortSignal;
    }): Promise<TaskResponse | undefined> => waitForTaskResponded(publicClient, args),

    getTaskResponseHash: (args: { taskId: TaskId }): Promise<Hex | null> => getTaskResponseHash(publicClient, args),

    getTaskStatus: (args: { taskId: TaskId }): Promise<TaskStatus> => getTaskStatus(publicClient, args),

    // Policy read functions
    policyUri: (): Promise<string> => policyReadFunctions.policyUri(publicClient),

    getPolicyData: (): Promise<Address[]> => policyReadFunctions.getPolicyData(publicClient),

    getPolicyUri: (): Promise<string> => policyReadFunctions.getPolicyUri(publicClient),

    getSchemaUri: (): Promise<string> => policyReadFunctions.getSchemaUri(publicClient),

    getEntrypoint: (): Promise<string> => policyReadFunctions.getEntrypoint(publicClient),

    getPolicyId: (args: { client: Address }): Promise<`0x${string}`> =>
      policyReadFunctions.getPolicyId(publicClient, args.client),

    getPolicyConfig: (args: {
      policyId: `0x${string}`;
    }): Promise<{ policyParams: `0x${string}`; expireAfter: number }> =>
      policyReadFunctions.getPolicyConfig(publicClient, args.policyId),

    supportsInterface: (args: { interfaceId: `0x${string}` }): Promise<boolean> =>
      policyReadFunctions.supportsInterface(publicClient, args.interfaceId),

    owner: (): Promise<Address> => policyReadFunctions.owner(publicClient),

    factory: (): Promise<Address> => policyReadFunctions.factory(publicClient),

    entrypoint: (): Promise<string> => policyReadFunctions.entrypoint(publicClient),

    schemaUri: (): Promise<string> => policyReadFunctions.schemaUri(publicClient),

    clientToPolicyId: (args: { client: Address }): Promise<`0x${string}`> =>
      policyReadFunctions.clientToPolicyId(publicClient, args.client),

    policyData: (args: { index: number }): Promise<Address> => policyReadFunctions.policyData(publicClient, args.index),

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
    }) => policyReadFunctions.precomputePolicyId(publicClient, args),
  };
};

export { newtonPublicClientActions, newtonWalletClientActions };
