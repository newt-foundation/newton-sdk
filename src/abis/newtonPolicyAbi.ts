export const NewtonPolicyAbi = [
  {
    inputs: [],
    name: 'InterfaceNotSupported',
    type: 'error',
  },
  {
    inputs: [],
    name: 'OnlyPolicyClient',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint8',
        name: 'version',
        type: 'uint8',
      },
    ],
    name: 'Initialized',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'previousOwner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'newOwner',
        type: 'address',
      },
    ],
    name: 'OwnershipTransferred',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'client',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'policyId',
        type: 'bytes32',
      },
      {
        components: [
          {
            internalType: 'bytes32',
            name: 'policyId',
            type: 'bytes32',
          },
          {
            internalType: 'string',
            name: 'policyUri',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'schemaUri',
            type: 'string',
          },
          {
            internalType: 'string',
            name: 'entrypoint',
            type: 'string',
          },
          {
            components: [
              {
                internalType: 'bytes',
                name: 'policyParams',
                type: 'bytes',
              },
              {
                internalType: 'uint32',
                name: 'expireAfter',
                type: 'uint32',
              },
            ],
            internalType: 'struct INewtonPolicy.PolicyConfig',
            name: 'policyConfig',
            type: 'tuple',
          },
          {
            internalType: 'address[]',
            name: 'policyData',
            type: 'address[]',
          },
        ],
        indexed: false,
        internalType: 'struct INewtonPolicy.Policy',
        name: 'policy',
        type: 'tuple',
      },
    ],
    name: 'PolicySet',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'clientToPolicyId',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'entrypoint',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'factory',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getEntrypoint',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'policyId',
        type: 'bytes32',
      },
    ],
    name: 'getPolicyConfig',
    outputs: [
      {
        components: [
          {
            internalType: 'bytes',
            name: 'policyParams',
            type: 'bytes',
          },
          {
            internalType: 'uint32',
            name: 'expireAfter',
            type: 'uint32',
          },
        ],
        internalType: 'struct INewtonPolicy.PolicyConfig',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getPolicyData',
    outputs: [
      {
        internalType: 'address[]',
        name: '',
        type: 'address[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'client',
        type: 'address',
      },
    ],
    name: 'getPolicyId',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getPolicyUri',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getSchemaUri',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_factory',
        type: 'address',
      },
      {
        internalType: 'string',
        name: '_entrypoint',
        type: 'string',
      },
      {
        internalType: 'string',
        name: '_policyUri',
        type: 'string',
      },
      {
        internalType: 'string',
        name: '_schemaUri',
        type: 'string',
      },
      {
        internalType: 'address[]',
        name: '_policyData',
        type: 'address[]',
      },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'policyData',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'policyUri',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'schemaUri',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'bytes',
            name: 'policyParams',
            type: 'bytes',
          },
          {
            internalType: 'uint32',
            name: 'expireAfter',
            type: 'uint32',
          },
        ],
        internalType: 'struct INewtonPolicy.PolicyConfig',
        name: 'policyConfig',
        type: 'tuple',
      },
    ],
    name: 'setPolicy',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes4',
        name: 'interfaceId',
        type: 'bytes4',
      },
    ],
    name: 'supportsInterface',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newOwner',
        type: 'address',
      },
    ],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
