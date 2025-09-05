import { mainnet, sepolia } from 'viem/chains';
import { Address, PublicClient } from 'viem';
import { SubmitEvaluationParams, TaskCreated, TaskId, TaskResponse, TaskStatus } from './types/task';
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
import {
  getTaskResponseHash,
  getTaskStatus,
  onTaskEvents,
  submitEvaluationRequest,
  waitForTaskCreated,
  WaitForTaskIdResult,
  waitForTaskResponded,
} from './modules/avs';
import {
  getPolicy,
  getPolicyCodeUri,
  getPolicyDataInfo,
  getPolicyDataRefs,
  precomputePolicyId,
  setPolicy,
} from './modules/policy';

const newtonPublicActions = () => (publicClient: PublicClient) => {
  if (publicClient?.chain?.id !== mainnet.id && publicClient?.chain?.id !== sepolia.id) {
    throw new Error(
      'Newton SDK: Invalid network specified for newtonPublicActions. Only mainnet and sepolia are supported',
    );
  }
  return {
    submitEvaluationRequest: (
      args: SubmitEvaluationParams,
    ): Promise<{ ok: true; taskId?: TaskId; txHash?: Hex } | { ok: false; error: NewtonError }> =>
      submitEvaluationRequest(publicClient, args),

    waitForTaskCreated: (args: {
      taskRequestId: string;
      client?: PublicClient; // optionally specify WS-enabled client
      timeoutMs?: number; // default e.g., 30_000
      abortSignal?: AbortSignal;
    }): Promise<WaitForTaskIdResult> => waitForTaskCreated(publicClient, args, {}),

    waitForTaskResponded: (args: {
      taskId: TaskId;
      client?: PublicClient;
      timeoutMs?: number; // may be short (< 1s) in fast paths
      abortSignal?: AbortSignal;
    }): Promise<TaskResponse | undefined> => waitForTaskResponded(publicClient, args),

    onTaskEvents: (args: {
      taskId: TaskId;
      onCreated?: (e: TaskCreated) => void;
      onResponded?: (e: TaskResponse) => void;
      onError?: (err: unknown) => void;
      client?: PublicClient;
    }): void => onTaskEvents(publicClient, args),

    getTaskResponseHash: (args: { taskId: TaskId }): Promise<Hex | null> => getTaskResponseHash(publicClient, args),

    getTaskStatus: (args: { taskId: TaskId }): Promise<TaskStatus> => getTaskStatus(publicClient, args),
    // avs module functions
    precomputePolicyId: (args: {
      policyContract: Address;
      policyData?: Address[];
      params: PolicyParamsJson;
      client: Address;
    }): PolicyId => precomputePolicyId(publicClient, args),

    setPolicy: (args: SetPolicyInput): Promise<SetPolicyResult | { ok: false; error: NewtonError }> =>
      setPolicy(publicClient, args),

    replacePolicy: (args: SetPolicyInput): Promise<SetPolicyResult | { ok: false; error: NewtonError }> =>
      setPolicy(publicClient, args),

    getPolicy: (args: { client: Address }): Promise<PolicyInfo | null> => getPolicy(publicClient, args),

    getPolicyCodeUri: (args: { policyContract: Address }): Promise<PolicyCodeInfo> =>
      getPolicyCodeUri(publicClient, args),

    getPolicyDataRefs: (args: { policyContract: Address }): Promise<Address[]> => getPolicyDataRefs(publicClient, args),

    getPolicyDataInfo: (args: { policyData: Address }): Promise<PolicyDataInfo> =>
      getPolicyDataInfo(publicClient, args),
  };
};

export { newtonPublicActions };
