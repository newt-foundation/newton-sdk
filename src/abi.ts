import type { Address, Hex, Log } from 'viem';

// Minimal ABI for the event (tuples expand the structs)
export const newtonAbi = [
  {
    type: 'event',
    name: 'TaskResponded',
    inputs: [
      {
        name: 'taskResponse',
        type: 'tuple',
        indexed: false,
        components: [
          { name: 'taskId', type: 'bytes32' },
          { name: 'policyClient', type: 'address' },
          { name: 'policyId', type: 'bytes32' },
          { name: 'policyAddress', type: 'address' },
          {
            name: 'intent',
            type: 'tuple',
            components: [
              { name: 'from', type: 'address' },
              { name: 'to', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'data', type: 'bytes' },
              { name: 'chainId', type: 'uint256' },
              { name: 'functionSignature', type: 'bytes' },
            ],
          },
          { name: 'evaluationResult', type: 'bytes' },
        ],
      },
      {
        name: 'taskResponseMetadata',
        type: 'tuple',
        indexed: false,
        components: [
          { name: 'taskResponsedBlock', type: 'uint32' },
          { name: 'responseExpireBlock', type: 'uint32' },
          { name: 'hashOfNonSigners', type: 'bytes32' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'taskResponseHash',
    stateMutability: 'view',
    inputs: [
      {
        name: 'taskId',
        type: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
      },
    ],
  },
] as const;

export type TaskRespondedLog = Log & {
  args: {
    taskResponse: {
      taskId: Hex;
      policyClient: Address;
      policyId: Hex;
      policyAddress: Address;
      intent: {
        from: Address;
        to: Address;
        value: bigint;
        data: Hex;
        chainId: bigint;
        functionSignature: Hex;
      };
      evaluationResult: Hex;
    };
    taskResponseMetadata: {
      taskResponsedBlock: number;
      responseExpireBlock: number;
      hashOfNonSigners: Hex;
    };
  };
};
