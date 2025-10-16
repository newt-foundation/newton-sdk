export const NewtonPolicyAbi = [
  {
    type: 'function',
    name: 'clientToPolicyId',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'entrypoint',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'factory',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getEntrypoint',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMetadataCid',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPolicyCid',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPolicyConfig',
    inputs: [
      {
        name: 'policyId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct INewtonPolicy.PolicyConfig',
        components: [
          {
            name: 'policyParams',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'expireAfter',
            type: 'uint32',
            internalType: 'uint32',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPolicyData',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address[]',
        internalType: 'address[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPolicyId',
    inputs: [
      {
        name: 'client',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSchemaCid',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      {
        name: '_factory',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_entrypoint',
        type: 'string',
        internalType: 'string',
      },
      {
        name: '_policyCid',
        type: 'string',
        internalType: 'string',
      },
      {
        name: '_schemaCid',
        type: 'string',
        internalType: 'string',
      },
      {
        name: '_policyData',
        type: 'address[]',
        internalType: 'address[]',
      },
      {
        name: '_metadataCid',
        type: 'string',
        internalType: 'string',
      },
      {
        name: '_owner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isPolicyVerified',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'metadataCid',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'policyCid',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'policyData',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'schemaCid',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setMetadataCid',
    inputs: [
      {
        name: '_metadataCid',
        type: 'string',
        internalType: 'string',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPolicy',
    inputs: [
      {
        name: 'policyConfig',
        type: 'tuple',
        internalType: 'struct INewtonPolicy.PolicyConfig',
        components: [
          {
            name: 'policyParams',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'expireAfter',
            type: 'uint32',
            internalType: 'uint32',
          },
        ],
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'supportsInterface',
    inputs: [
      {
        name: 'interfaceId',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [
      {
        name: 'newOwner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Initialized',
    inputs: [
      {
        name: 'version',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      {
        name: 'previousOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PolicySet',
    inputs: [
      {
        name: 'client',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'policyId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'policy',
        type: 'tuple',
        indexed: false,
        internalType: 'struct INewtonPolicy.SetPolicyInfo',
        components: [
          {
            name: 'policyId',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'policyAddress',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'owner',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'policyCid',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'schemaCid',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'entrypoint',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'policyConfig',
            type: 'tuple',
            internalType: 'struct INewtonPolicy.PolicyConfig',
            components: [
              {
                name: 'policyParams',
                type: 'bytes',
                internalType: 'bytes',
              },
              {
                name: 'expireAfter',
                type: 'uint32',
                internalType: 'uint32',
              },
            ],
          },
          {
            name: 'policyData',
            type: 'address[]',
            internalType: 'address[]',
          },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'policyMetadataCidUpdated',
    inputs: [
      {
        name: 'metadataCid',
        type: 'string',
        indexed: false,
        internalType: 'string',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'InterfaceNotSupported',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OnlyPolicyClient',
    inputs: [],
  },
] as const;
