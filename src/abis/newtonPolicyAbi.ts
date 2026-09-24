// Auto-generated from newton-contracts. DO NOT EDIT.
// Regenerate with: pnpm sync-abis

export const NewtonPolicyAbi = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "clientToPolicyId",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "entrypoint",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "factory",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEntrypoint",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMetadataCid",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPolicyCid",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPolicyCodeHash",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPolicyConfig",
    "inputs": [
      {
        "name": "policyId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct INewtonPolicy.PolicyConfig",
        "components": [
          {
            "name": "policyParams",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "expireAfter",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPolicyId",
    "inputs": [
      {
        "name": "client",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSchemaCid",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSecretsSchemaCid",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getWasmCid",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      {
        "name": "_factory",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "artifacts",
        "type": "tuple",
        "internalType": "struct INewtonPolicy.PolicyArtifacts",
        "components": [
          {
            "name": "entrypoint",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "policyCid",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "schemaCid",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "wasmCid",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "secretsSchemaCid",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "metadataCid",
            "type": "string",
            "internalType": "string"
          }
        ]
      },
      {
        "name": "_owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_policyCodeHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isPolicyVerified",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "metadataCid",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "policyCid",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "policyCodeHash",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "schemaCid",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "secretsSchemaCid",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setMetadataCid",
    "inputs": [
      {
        "name": "_metadataCid",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPolicy",
    "inputs": [
      {
        "name": "policyConfig",
        "type": "tuple",
        "internalType": "struct INewtonPolicy.PolicyConfig",
        "components": [
          {
            "name": "policyParams",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "expireAfter",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setSecretsSchemaCid",
    "inputs": [
      {
        "name": "_secretsSchemaCid",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "supportsInterface",
    "inputs": [
      {
        "name": "interfaceId",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "version",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "wasmCid",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Initialized",
    "inputs": [
      {
        "name": "version",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PolicySet",
    "inputs": [
      {
        "name": "client",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "policyId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "policy",
        "type": "tuple",
        "indexed": false,
        "internalType": "struct INewtonPolicy.SetPolicyInfo",
        "components": [
          {
            "name": "policyId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "policyAddress",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "owner",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "policyCid",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "schemaCid",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "entrypoint",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "policyConfig",
            "type": "tuple",
            "internalType": "struct INewtonPolicy.PolicyConfig",
            "components": [
              {
                "name": "policyParams",
                "type": "bytes",
                "internalType": "bytes"
              },
              {
                "name": "expireAfter",
                "type": "uint32",
                "internalType": "uint32"
              }
            ]
          },
          {
            "name": "wasmCid",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "secretsSchemaCid",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "policyCodeHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "version",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SecretsSchemaCidUpdated",
    "inputs": [
      {
        "name": "secretsSchemaCid",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "policyMetadataCidUpdated",
    "inputs": [
      {
        "name": "metadataCid",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "InterfaceNotSupported",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidPolicyCodeHash",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidShortString",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OnlyPolicyClient",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SecretsSchemaWithoutWasm",
    "inputs": []
  },
  {
    "type": "error",
    "name": "StringTooLong",
    "inputs": [
      {
        "name": "str",
        "type": "string",
        "internalType": "string"
      }
    ]
  }
] as const

export const NewtonPolicyFactoryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_version",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "ADMIN_ROLE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "computePolicyAddress",
    "inputs": [
      {
        "name": "_entrypoint",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_policyCid",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_schemaCid",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_wasmCid",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_secretsSchemaCid",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_metadataCid",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_policyCodeHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "predicted",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deployPolicy",
    "inputs": [
      {
        "name": "_entrypoint",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_policyCid",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_schemaCid",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_wasmCid",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_secretsSchemaCid",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_metadataCid",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_policyCodeHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "policyAddr",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAllPoliciesByOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAllPolicyOwners",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "grantRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "hasRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "implementation",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "initializeV2",
    "inputs": [
      {
        "name": "admin",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isPolicy",
    "inputs": [
      {
        "name": "policy",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ownersToPolicies",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "proxyAdmin",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ProxyAdmin"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revokeRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setImplementation",
    "inputs": [
      {
        "name": "newImplementation",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "version",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "ImplementationUpdated",
    "inputs": [
      {
        "name": "oldImplementation",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newImplementation",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Initialized",
    "inputs": [
      {
        "name": "version",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PolicyDeployed",
    "inputs": [
      {
        "name": "policy",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "policyInfo",
        "type": "tuple",
        "indexed": false,
        "internalType": "struct INewtonPolicy.PolicyInfo",
        "components": [
          {
            "name": "policyAddress",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "owner",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "metadataCid",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "policyCid",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "schemaCid",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "entrypoint",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "wasmCid",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "secretsSchemaCid",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "policyCodeHash",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      },
      {
        "name": "implementationVersion",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AdminAddressZero",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ChainNotSupported",
    "inputs": [
      {
        "name": "chainId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "Create2Failed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidImplementationAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidOwnerAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidShortString",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAdminOrOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SecretsSchemaWithoutWasm",
    "inputs": []
  },
  {
    "type": "error",
    "name": "StringTooLong",
    "inputs": [
      {
        "name": "str",
        "type": "string",
        "internalType": "string"
      }
    ]
  }
] as const

export const NewtonPolicyClientAbi = [
  {
    "type": "function",
    "name": "getNewtonPolicyTaskManager",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getOwner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPolicies",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct INewtonPolicyClient.PolicySpec[]",
        "components": [
          {
            "name": "policy",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "config",
            "type": "tuple",
            "internalType": "struct INewtonPolicy.PolicyConfig",
            "components": [
              {
                "name": "policyParams",
                "type": "bytes",
                "internalType": "bytes"
              },
              {
                "name": "expireAfter",
                "type": "uint32",
                "internalType": "uint32"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPolicyId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPolicySetSnapshot",
    "inputs": [],
    "outputs": [
      {
        "name": "policyId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "revision",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "policies",
        "type": "tuple[]",
        "internalType": "struct INewtonPolicyClient.PolicySpec[]",
        "components": [
          {
            "name": "policy",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "config",
            "type": "tuple",
            "internalType": "struct INewtonPolicy.PolicyConfig",
            "components": [
              {
                "name": "policyParams",
                "type": "bytes",
                "internalType": "bytes"
              },
              {
                "name": "expireAfter",
                "type": "uint32",
                "internalType": "uint32"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "policyRevision",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setPolicies",
    "inputs": [
      {
        "name": "policies",
        "type": "tuple[]",
        "internalType": "struct INewtonPolicyClient.PolicySpec[]",
        "components": [
          {
            "name": "policy",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "config",
            "type": "tuple",
            "internalType": "struct INewtonPolicy.PolicyConfig",
            "components": [
              {
                "name": "policyParams",
                "type": "bytes",
                "internalType": "bytes"
              },
              {
                "name": "expireAfter",
                "type": "uint32",
                "internalType": "uint32"
              }
            ]
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "policyId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "supportsInterface",
    "inputs": [
      {
        "name": "interfaceId",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "PoliciesUpdated",
    "inputs": [
      {
        "name": "previousPolicyId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "newPolicyId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "revision",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "policies",
        "type": "tuple[]",
        "indexed": false,
        "internalType": "struct INewtonPolicyClient.PolicySpec[]",
        "components": [
          {
            "name": "policy",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "config",
            "type": "tuple",
            "internalType": "struct INewtonPolicy.PolicyConfig",
            "components": [
              {
                "name": "policyParams",
                "type": "bytes",
                "internalType": "bytes"
              },
              {
                "name": "expireAfter",
                "type": "uint32",
                "internalType": "uint32"
              }
            ]
          }
        ]
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PolicyClientInitialized",
    "inputs": [
      {
        "name": "taskManager",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PolicyClientOwnerUpdated",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "EmptyPolicySet",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidPolicyID",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PolicyFactoryNotSet",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PolicyNotRegistered",
    "inputs": [
      {
        "name": "policy",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "PolicyParamsTooLarge",
    "inputs": [
      {
        "name": "index",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "size",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "TooManyPolicies",
    "inputs": [
      {
        "name": "given",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "max",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ZeroExpireAfter",
    "inputs": [
      {
        "name": "index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  }
] as const

