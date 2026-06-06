// Auto-generated from newton-contracts. DO NOT EDIT.
// Regenerate with: pnpm sync-abis

export const IdentityRegistryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_provider",
        "type": "address",
        "internalType": "contract INewtonAddressesProvider"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "LINK_SIGNER_TYPEHASH",
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
    "name": "LINK_USER_TYPEHASH",
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
    "name": "MAX_LINKS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "REGISTER_IDENTITY_TYPEHASH",
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
    "name": "addressesProvider",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract INewtonAddressesProvider"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "attestationValidator",
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
    "name": "batchTaskManager",
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
    "name": "challengeVerifier",
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
    "name": "eip712Domain",
    "inputs": [],
    "outputs": [
      {
        "name": "fields",
        "type": "bytes1",
        "internalType": "bytes1"
      },
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "version",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "verifyingContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "salt",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "extensions",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getLinkedDomains",
    "inputs": [
      {
        "name": "policyClient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "clientUser",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasLinkedIdentity",
    "inputs": [
      {
        "name": "policyClient",
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
    "name": "identityData",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
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
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "linkIdentity",
    "inputs": [
      {
        "name": "_identityOwner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_clientUser",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_policyClient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_identityDomains",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      },
      {
        "name": "_identityOwnerSignature",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "_identityOwnerNonce",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_identityOwnerDeadline",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_clientUserSignature",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "_clientUserNonce",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_clientUserDeadline",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "linkIdentityAsSigner",
    "inputs": [
      {
        "name": "_policyClient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_identityDomains",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      },
      {
        "name": "_clientUser",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_signature",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "_nonce",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_deadline",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "linkIdentityAsSignerAndUser",
    "inputs": [
      {
        "name": "_policyClient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_identityDomains",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "linkIdentityAsUser",
    "inputs": [
      {
        "name": "_identityOwner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_policyClient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_identityDomains",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      },
      {
        "name": "_signature",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "_nonce",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_deadline",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "nonces",
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
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "operatorRegistry",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IOperatorRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "policyClientLinks",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
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
    "name": "policyClientRegistry",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IPolicyClientRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registerIdentityData",
    "inputs": [
      {
        "name": "_identityDomain",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "_dataRefId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_gatewaySignature",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "_deadline",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "regoVerifier",
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
    "name": "seedLinkCount",
    "inputs": [
      {
        "name": "policyClient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "count",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "serviceManager",
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
    "name": "socketRegistry",
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
    "name": "stateCommitRegistry",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IStateRootCommittable"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "taskManager",
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
    "name": "unlinkIdentityAsSigner",
    "inputs": [
      {
        "name": "_clientUser",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_policyClient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_identityDomains",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "unlinkIdentityAsUser",
    "inputs": [
      {
        "name": "_policyClient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_identityDomains",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "viewBN254CertificateVerifier",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IViewBN254CertificateVerifier"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "EIP712DomainChanged",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "IdentityBound",
    "inputs": [
      {
        "name": "identityOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "identityDomain",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "identityData",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "IdentityLinked",
    "inputs": [
      {
        "name": "identityOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "policyClient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "policyClientUser",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "identityDomain",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "IdentityUnlinked",
    "inputs": [
      {
        "name": "identityOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "policyClient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "policyClientUser",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "identityDomain",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
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
    "type": "error",
    "name": "InvalidAccountNonce",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "currentNonce",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidClientRegistryAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidIdentityDomain",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidIdentitySubmitter",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidOperatorRegistryAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidSignature",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidUnlinker",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LinkAlreadyExists",
    "inputs": [
      {
        "name": "policyClient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "clientUser",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "identityDomain",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "NoEmptyDomainsArray",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PolicyClientNotRegistered",
    "inputs": [
      {
        "name": "client",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "SignatureExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TooManyDomainsAtOnce",
    "inputs": []
  }
] as const

