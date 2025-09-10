import { Address } from '@core/types';
import { PolicyId, PolicyParamsJson } from '@core/types/policy';
import { PublicClient, WalletClient, parseAbi, keccak256, encodePacked } from 'viem';

// Real contract ABI from the actual deployed contract
const POLICY_CONTRACT_ABI = parseAbi([
  'function policyUri() view returns (string)',
  'function getPolicyData() view returns (address[])',
  'function getPolicyUri() view returns (string)',
  'function getSchemaUri() view returns (string)',
  'function getEntrypoint() view returns (string)',
  'function getPolicyId(address client) view returns (bytes32)',
  'function getPolicyConfig(bytes32 policyId) view returns (tuple(bytes policyParams, uint32 expireAfter))',
  'function setPolicy(tuple(bytes policyParams, uint32 expireAfter) policyConfig) returns (bytes32)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  'function owner() view returns (address)',
  'function factory() view returns (address)',
  'function entrypoint() view returns (string)',
  'function schemaUri() view returns (string)',
  'function clientToPolicyId(address) view returns (bytes32)',
  'function policyData(uint256) view returns (address)',
]);

const POLICY_CONTRACT_ADDRESS = '0x7a236e79cf68957fe26451783061663ab2cf9a73' as Address;

// Read function wrappers - exact same names as on-chain functions
const policyUri = async (publicClient: PublicClient): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'policyUri',
    });
    return result as string;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get policyUri - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const getPolicyData = async (publicClient: PublicClient): Promise<Address[]> => {
  try {
    const result = await publicClient.readContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'getPolicyData',
    });
    return result as Address[];
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getPolicyData - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const getPolicyUri = async (publicClient: PublicClient): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'getPolicyUri',
    });
    return result as string;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getPolicyUri - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const getSchemaUri = async (publicClient: PublicClient): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'getSchemaUri',
    });
    return result as string;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getSchemaUri - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const getEntrypoint = async (publicClient: PublicClient): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'getEntrypoint',
    });
    return result as string;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getEntrypoint - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const getPolicyId = async (publicClient: PublicClient, client: Address): Promise<`0x${string}`> => {
  try {
    const result = await publicClient.readContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'getPolicyId',
      args: [client],
    });
    return result as `0x${string}`;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getPolicyId - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const getPolicyConfig = async (
  publicClient: PublicClient,
  policyId: `0x${string}`,
): Promise<{ policyParams: `0x${string}`; expireAfter: number }> => {
  try {
    const result = await publicClient.readContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'getPolicyConfig',
      args: [policyId],
    });
    return result as { policyParams: `0x${string}`; expireAfter: number };
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getPolicyConfig - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const supportsInterface = async (publicClient: PublicClient, interfaceId: `0x${string}`): Promise<boolean> => {
  try {
    const result = await publicClient.readContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'supportsInterface',
      args: [interfaceId],
    });
    return result as boolean;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get supportsInterface - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const owner = async (publicClient: PublicClient): Promise<Address> => {
  try {
    const result = await publicClient.readContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'owner',
    });
    return result as Address;
  } catch (error) {
    throw new Error(`Newton SDK: Failed to get owner - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const factory = async (publicClient: PublicClient): Promise<Address> => {
  try {
    const result = await publicClient.readContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'factory',
    });
    return result as Address;
  } catch (error) {
    throw new Error(`Newton SDK: Failed to get factory - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const entrypoint = async (publicClient: PublicClient): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'entrypoint',
    });
    return result as string;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get entrypoint - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const schemaUri = async (publicClient: PublicClient): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'schemaUri',
    });
    return result as string;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get schemaUri - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const clientToPolicyId = async (publicClient: PublicClient, client: Address): Promise<`0x${string}`> => {
  try {
    const result = await publicClient.readContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'clientToPolicyId',
      args: [client],
    });
    return result as `0x${string}`;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get clientToPolicyId - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const policyData = async (publicClient: PublicClient, index: number): Promise<Address> => {
  try {
    const result = await publicClient.readContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'policyData',
      args: [index],
    });
    return result as Address;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get policyData - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const precomputePolicyId = (
  publicClient: PublicClient,
  args: {
    policyContract: Address;
    policyData: Address[];
    params: PolicyParamsJson;
    client: Address;
    policyUri: string;
    schemaUri: string;
    entrypoint: string;
    expireAfter?: number;
    blockTimestamp?: bigint;
  },
): PolicyId => {
  try {
    const blockTimestamp = args.blockTimestamp || BigInt(Math.floor(Date.now() / 1000));

    const paramsBytes =
      `0x${new TextEncoder().encode(JSON.stringify(args.params)).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')}` as `0x${string}`;

    const policyConfig = {
      policyParams: paramsBytes,
      expireAfter: args.expireAfter || 0,
    };

    // This replicates the solidity policyId computation in setPolicy found here: https://github.com/newt-foundation/newton-prover-avs/blob/712c435a663d168db111f4001f85d0cf0ed7d9c2/contracts/src/core/NewtonPolicy.sol#L64-L66
    const encoded = encodePacked(
      ['address', 'address[]', 'string', 'string', 'string', 'tuple(bytes,uint32)', 'uint256'],
      [args.client, args.policyData, args.policyUri, args.schemaUri, args.entrypoint, policyConfig, blockTimestamp],
    );

    const policyId = keccak256(encoded);
    return policyId as PolicyId;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to precompute policy ID - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

// Write function wrappers
const setPolicy = async (
  walletClient: WalletClient,
  args: {
    policyConfig: {
      policyParams: `0x${string}`;
      expireAfter: number;
    };
  },
): Promise<`0x${string}`> => {
  try {
    if (!walletClient.chain || !walletClient.account) {
      throw new Error('Newton SDK: account and chain must be set on Wallet client');
    }
    const hash = await walletClient.writeContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'setPolicy',
      args: [args.policyConfig],
      chain: walletClient.chain,
      account: walletClient.account,
    });
    return hash;
  } catch (error) {
    throw new Error(`Newton SDK: Failed to set policy - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const initialize = async (
  walletClient: WalletClient,
  args: {
    factory: Address;
    entrypoint: string;
    policyUri: string;
    schemaUri: string;
    policyData: Address[];
  },
): Promise<`0x${string}`> => {
  try {
    if (!walletClient.chain || !walletClient.account) {
      throw new Error('Newton SDK: account and chain must be set on Wallet client');
    }
    const hash = await walletClient.writeContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'initialize',
      args: [args.factory, args.entrypoint, args.policyUri, args.schemaUri, args.policyData],
      chain: walletClient.chain,
      account: walletClient.account,
    });
    return hash;
  } catch (error) {
    throw new Error(`Newton SDK: Failed to initialize - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const renounceOwnership = async (walletClient: WalletClient): Promise<`0x${string}`> => {
  try {
    if (!walletClient.chain || !walletClient.account) {
      throw new Error('Newton SDK: account and chain must be set on Wallet client');
    }
    const hash = await walletClient.writeContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'renounceOwnership',
      chain: walletClient.chain,
      account: walletClient.account,
    });
    return hash;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to renounce ownership - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const transferOwnership = async (walletClient: WalletClient, args: { newOwner: Address }): Promise<`0x${string}`> => {
  try {
    if (!walletClient.chain || !walletClient.account) {
      throw new Error('Newton SDK: account and chain must be set on Wallet client');
    }
    const hash = await walletClient.writeContract({
      address: POLICY_CONTRACT_ADDRESS,
      abi: POLICY_CONTRACT_ABI,
      functionName: 'transferOwnership',
      args: [args.newOwner],
      chain: walletClient.chain,
      account: walletClient.account,
    });
    return hash;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to transfer ownership - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

export const policyWriteFunctions = {
  // On-chain write functions
  setPolicy,
  initialize,
  renounceOwnership,
  transferOwnership,
};

export const policyReadFunctions = {
  // On-chain read functions
  policyUri,
  getPolicyData,
  getPolicyUri,
  getSchemaUri,
  getEntrypoint,
  getPolicyId,
  getPolicyConfig,
  supportsInterface,
  owner,
  factory,
  entrypoint,
  schemaUri,
  clientToPolicyId,
  policyData,
  // Off-chain functions
  precomputePolicyId,
};

export const policyFunctions = {
  // On-chain read functions
  ...policyReadFunctions,
  // On-chain write functions
  ...policyWriteFunctions,
};
