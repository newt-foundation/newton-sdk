import { Address } from '@core/types';
import { NewtonError } from '@core/types/core/sdk-exceptions';
import {
  PolicyCodeInfo,
  PolicyDataInfo,
  PolicyId,
  PolicyInfo,
  PolicyParamsJson,
  SetPolicyInput,
  SetPolicyResult,
} from '@core/types/policy';
import { PublicClient, WalletClient } from 'viem';

const precomputePolicyId = (
  publicClient: PublicClient,
  args: {
    policyContract: Address;
    policyData?: Address[];
    params: PolicyParamsJson;
    client: Address;
  },
): PolicyId => {
  console.log('precomputePolicyId args: ', args, publicClient);
  throw new Error('Newton SDK: precomputePolicyId Not implemented');
};

const setPolicy = (
  publicClient: PublicClient,
  walletClient: WalletClient,
  args: SetPolicyInput,
): Promise<SetPolicyResult | { ok: false; error: NewtonError }> => {
  console.log('setPolicy args: ', args, publicClient, walletClient);
  throw new Error('Newton SDK: setPolicy Not implemented');
};

const getPolicy = (publicClient: PublicClient, args: { client: Address }): Promise<PolicyInfo | null> => {
  console.log('getPolicy args: ', args, publicClient);
  throw new Error('Newton SDK: getPolicy Not implemented');
};

const getPolicyCodeUri = (publicClient: PublicClient, args: { policyContract: Address }): Promise<PolicyCodeInfo> => {
  console.log('getPolicyCodeUri args: ', args, publicClient);
  throw new Error('Newton SDK: getPolicyCodeUri Not implemented');
};

const getPolicyDataRefs = (publicClient: PublicClient, args: { policyContract: Address }): Promise<Address[]> => {
  console.log('getPolicyDataRefs args: ', args, publicClient);
  throw new Error('Newton SDK: getPolicyDataRefs Not implemented');
};

const getPolicyDataInfo = (publicClient: PublicClient, args: { policyData: Address }): Promise<PolicyDataInfo> => {
  console.log('getPolicyDataInfo args: ', args, publicClient);
  throw new Error('Newton SDK: getPolicyDataInfo Not implemented');
};

export { precomputePolicyId, setPolicy, getPolicy, getPolicyCodeUri, getPolicyDataRefs, getPolicyDataInfo };
