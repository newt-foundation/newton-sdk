import { mainnet, sepolia } from 'viem/chains';
import { Address, createPublicClient, http, PublicClient, WalletClient } from 'viem';
import { CreateTaskParams, TaskId, TaskResponse, TaskStatus } from './types/task';
import { Hex } from './types';
import { NewtonError } from './types/core/sdk-exceptions';
import {
  PolicyCodeInfo,
  PolicyDataInfo,
  PolicyId,
  PolicyInfo,
  PolicyParamsJson,
  SetPolicyInput,
  SetPolicyResult,
} from './types/policy';
import { getTaskResponseHash, getTaskStatus, submitEvaluationRequest, waitForTaskResponded } from './modules/avs';
import {
  getPolicy,
  getPolicyCodeUri,
  getPolicyDataInfo,
  getPolicyDataRefs,
  precomputePolicyId,
  setPolicy,
} from './modules/policy';

const newtonWalletClientActions = (publicClient?: PublicClient) => (walletClient: WalletClient) => {
  if (walletClient?.chain?.id !== mainnet.id && walletClient?.chain?.id !== sepolia.id) {
    throw new Error(
      'Newton SDK: Invalid network specified for newtonWalletClientActions. Only mainnet and sepolia are supported',
    );
  }
  return {
    submitEvaluationRequest: (
      args: CreateTaskParams,
    ): Promise<{ ok: true; taskId?: TaskId; txHash?: Hex } | { ok: false; error: NewtonError }> =>
      submitEvaluationRequest(
        publicClient ?? createPublicClient({ chain: walletClient.chain, transport: http() }),
        walletClient,
        args,
      ),

    setPolicy: (args: SetPolicyInput): Promise<SetPolicyResult | { ok: false; error: NewtonError }> =>
      setPolicy(
        publicClient ?? createPublicClient({ chain: walletClient.chain, transport: http() }),
        walletClient,
        args,
      ),

    replacePolicy: (args: SetPolicyInput): Promise<SetPolicyResult | { ok: false; error: NewtonError }> =>
      setPolicy(
        publicClient ?? createPublicClient({ chain: walletClient.chain, transport: http() }),
        walletClient,
        args,
      ),
  };
};

const newtonPublicClientActions = () => (publicClient: PublicClient) => {
  if (publicClient?.chain?.id !== mainnet.id && publicClient?.chain?.id !== sepolia.id) {
    throw new Error(
      'Newton SDK: Invalid network specified for newtonPublicActions. Only mainnet and sepolia are supported',
    );
  }
  return {
    waitForTaskResponded: (args: {
      taskId: TaskId;
      timeoutMs?: number; // may be short (< 1s) in fast paths
      abortSignal?: AbortSignal;
    }): Promise<TaskResponse | undefined> => waitForTaskResponded(publicClient, args),

    getTaskResponseHash: (args: { taskId: TaskId }): Promise<Hex | null> => getTaskResponseHash(publicClient, args),

    getTaskStatus: (args: { taskId: TaskId }): Promise<TaskStatus> => getTaskStatus(publicClient, args),
    // avs module functions
    precomputePolicyId: (args: {
      policyContract: Address;
      policyData?: Address[];
      params: PolicyParamsJson;
      client: Address;
    }): PolicyId => precomputePolicyId(publicClient, args),

    getPolicy: (args: { client: Address }): Promise<PolicyInfo | null> => getPolicy(publicClient, args),

    getPolicyCodeUri: (args: { policyContract: Address }): Promise<PolicyCodeInfo> =>
      getPolicyCodeUri(publicClient, args),

    getPolicyDataRefs: (args: { policyContract: Address }): Promise<Address[]> => getPolicyDataRefs(publicClient, args),

    getPolicyDataInfo: (args: { policyData: Address }): Promise<PolicyDataInfo> =>
      getPolicyDataInfo(publicClient, args),
  };
};

export { newtonPublicClientActions, newtonWalletClientActions };
