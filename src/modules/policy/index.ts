import { NewtonPolicyAbi } from '@core/abis/newtonPolicyAbi';
import { PolicyId, PolicyParamsJson } from '@core/types/policy';
import { PublicClient, WalletClient, keccak256, encodePacked, Address, fromHex, toHex } from 'viem';

// Read function wrappers - exact same names as on-chain functions
const policyUri = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'policyUri',
    });
    return result as string;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get policyUri - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const getPolicyData = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
}): Promise<Address[]> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'getPolicyData',
    });
    return result as Address[];
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getPolicyData - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const getPolicyUri = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'getPolicyUri',
    });
    return result as string;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getPolicyUri - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const getSchemaUri = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'getSchemaUri',
    });
    return result as string;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getSchemaUri - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const getEntrypoint = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'getEntrypoint',
    });
    return result as string;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getEntrypoint - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const getPolicyId = async ({
  publicClient,
  policyContractAddress,
  client,
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
  client: Address;
}): Promise<`0x${string}`> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
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

const getPolicyConfig = async ({
  publicClient,
  policyContractAddress,
  policyId,
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
  policyId: `0x${string}`;
}): Promise<{ policyParams: string | object; policyParamsHex: `0x${string}`; expireAfter: number }> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'getPolicyConfig',
      args: [policyId],
    });
    // Hex decode result.policyParams
    const policyParams = fromHex(result.policyParams, 'string');
    let policyParamsObject = undefined;
    try {
      policyParamsObject = JSON.parse(policyParams);
    } catch (error) {
      policyParamsObject = policyParams;
    }
    return {
      policyParams: policyParamsObject ?? policyParams,
      policyParamsHex: result.policyParams,
      expireAfter: result.expireAfter,
    } as {
      policyParams: string;
      policyParamsHex: `0x${string}`;
      expireAfter: number;
    };
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get getPolicyConfig - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const supportsInterface = async ({
  publicClient,
  policyContractAddress,
  interfaceId,
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
  interfaceId: `0x${string}`;
}): Promise<boolean> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
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

const owner = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
}): Promise<Address> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'owner',
    });
    return result as Address;
  } catch (error) {
    throw new Error(`Newton SDK: Failed to get owner - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const factory = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
}): Promise<Address> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'factory',
    });
    return result as Address;
  } catch (error) {
    throw new Error(`Newton SDK: Failed to get factory - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const entrypoint = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'entrypoint',
    });
    return result as string;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get entrypoint - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const schemaUri = async ({
  publicClient,
  policyContractAddress,
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
}): Promise<string> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'schemaUri',
    });
    return result as string;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get schemaUri - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const clientToPolicyId = async ({
  publicClient,
  policyContractAddress,
  client,
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
  client: Address;
}): Promise<`0x${string}`> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
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

const policyData = async ({
  publicClient,
  policyContractAddress,
  index,
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
  index: number;
}): Promise<Address> => {
  try {
    const result = await publicClient.readContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'policyData',
      args: [BigInt(index)],
    });
    return result as Address;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to get policyData - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const precomputePolicyId = ({
  publicClient,
  policyContractAddress,
  ...args
}: {
  publicClient: PublicClient;
  policyContractAddress: Address;
  policyContract: Address;
  policyData: Address[];
  params: PolicyParamsJson;
  client: Address;
  policyUri: string;
  schemaUri: string;
  entrypoint: string;
  expireAfter?: number;
  blockTimestamp?: bigint;
}): PolicyId => {
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
const setPolicy = async ({
  walletClient,
  policyContractAddress,
  ...args
}: {
  walletClient: WalletClient;
  policyContractAddress: Address;
  policyConfig: {
    policyParams: object;
    expireAfter: number;
  };
}): Promise<`0x${string}`> => {
  try {
    if (!walletClient.chain) {
      throw new Error('Newton SDK: account and chain must be set on Wallet client');
    }

    // Hex encode the policyParams JSON object
    const paramsBytes = toHex(JSON.stringify(args.policyConfig.policyParams));

    const encodedPolicyConfig = {
      policyParams: paramsBytes,
      expireAfter: args.policyConfig.expireAfter,
    };

    const account = walletClient.account ?? (await walletClient.getAddresses())[0];
    const hash = await walletClient.writeContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'setPolicy',
      args: [encodedPolicyConfig],
      chain: walletClient.chain,
      account,
    });
    return hash;
  } catch (error) {
    throw new Error(`Newton SDK: Failed to set policy - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const initialize = async ({
  walletClient,
  policyContractAddress,
  ...args
}: {
  walletClient: WalletClient;
  policyContractAddress: Address;
  factory: Address;
  entrypoint: string;
  policyUri: string;
  schemaUri: string;
  policyData: Address[];
}): Promise<`0x${string}`> => {
  try {
    if (!walletClient.chain) {
      throw new Error('Newton SDK: account and chain must be set on Wallet client');
    }

    const account = walletClient.account ?? (await walletClient.getAddresses())[0];
    const hash = await walletClient.writeContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'initialize',
      args: [args.factory, args.entrypoint, args.policyUri, args.schemaUri, args.policyData],
      chain: walletClient.chain,
      account,
    });
    return hash;
  } catch (error) {
    throw new Error(`Newton SDK: Failed to initialize - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const renounceOwnership = async ({
  walletClient,
  policyContractAddress,
}: {
  walletClient: WalletClient;
  policyContractAddress: Address;
}): Promise<`0x${string}`> => {
  try {
    if (!walletClient.chain) {
      throw new Error('Newton SDK: account and chain must be set on Wallet client');
    }

    const account = walletClient.account ?? (await walletClient.getAddresses())[0];
    const hash = await walletClient.writeContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'renounceOwnership',
      chain: walletClient.chain,
      account,
    });
    return hash;
  } catch (error) {
    throw new Error(
      `Newton SDK: Failed to renounce ownership - ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

const transferOwnership = async ({
  walletClient,
  policyContractAddress,
  ...args
}: {
  walletClient: WalletClient;
  policyContractAddress: Address;
  newOwner: Address;
}): Promise<`0x${string}`> => {
  try {
    if (!walletClient.chain) {
      throw new Error('Newton SDK: account and chain must be set on Wallet client');
    }

    const account = walletClient.account ?? (await walletClient.getAddresses())[0];
    const hash = await walletClient.writeContract({
      address: policyContractAddress,
      abi: NewtonPolicyAbi,
      functionName: 'transferOwnership',
      args: [args.newOwner],
      chain: walletClient.chain,
      account,
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
