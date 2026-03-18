/**
 * IdentityRegistry ABI — registerIdentityData, link/unlink functions, and events
 * for identity-to-PolicyClient associations.
 *
 * Auto-synced from newton-prover-avs contracts. Do not edit manually.
 */
export const IdentityRegistryAbi = [
  {
    type: 'function',
    name: 'linkIdentity',
    inputs: [
      { name: '_identityOwner', type: 'address', internalType: 'address' },
      { name: '_clientUser', type: 'address', internalType: 'address' },
      { name: '_policyClient', type: 'address', internalType: 'address' },
      { name: '_identityDomains', type: 'bytes32[]', internalType: 'bytes32[]' },
      { name: '_identityOwnerSignature', type: 'bytes', internalType: 'bytes' },
      { name: '_identityOwnerNonce', type: 'uint256', internalType: 'uint256' },
      { name: '_identityOwnerDeadline', type: 'uint256', internalType: 'uint256' },
      { name: '_clientUserSignature', type: 'bytes', internalType: 'bytes' },
      { name: '_clientUserNonce', type: 'uint256', internalType: 'uint256' },
      { name: '_clientUserDeadline', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'linkIdentityAsSigner',
    inputs: [
      { name: '_policyClient', type: 'address', internalType: 'address' },
      { name: '_identityDomains', type: 'bytes32[]', internalType: 'bytes32[]' },
      { name: '_clientUser', type: 'address', internalType: 'address' },
      { name: '_signature', type: 'bytes', internalType: 'bytes' },
      { name: '_nonce', type: 'uint256', internalType: 'uint256' },
      { name: '_deadline', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'linkIdentityAsSignerAndUser',
    inputs: [
      { name: '_policyClient', type: 'address', internalType: 'address' },
      { name: '_identityDomains', type: 'bytes32[]', internalType: 'bytes32[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'linkIdentityAsUser',
    inputs: [
      { name: '_identityOwner', type: 'address', internalType: 'address' },
      { name: '_policyClient', type: 'address', internalType: 'address' },
      { name: '_identityDomains', type: 'bytes32[]', internalType: 'bytes32[]' },
      { name: '_signature', type: 'bytes', internalType: 'bytes' },
      { name: '_nonce', type: 'uint256', internalType: 'uint256' },
      { name: '_deadline', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unlinkIdentityAsSigner',
    inputs: [
      { name: '_clientUser', type: 'address', internalType: 'address' },
      { name: '_policyClient', type: 'address', internalType: 'address' },
      { name: '_identityDomains', type: 'bytes32[]', internalType: 'bytes32[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unlinkIdentityAsUser',
    inputs: [
      { name: '_policyClient', type: 'address', internalType: 'address' },
      { name: '_identityDomains', type: 'bytes32[]', internalType: 'bytes32[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'registerIdentityData',
    inputs: [
      { name: '_identityDomain', type: 'bytes32', internalType: 'bytes32' },
      { name: '_dataRefId', type: 'string', internalType: 'string' },
      { name: '_gatewaySignature', type: 'bytes', internalType: 'bytes' },
      { name: '_deadline', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'policyClientLinks',
    inputs: [
      { name: '', type: 'address', internalType: 'address' },
      { name: '', type: 'address', internalType: 'address' },
      { name: '', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'identityData',
    inputs: [
      { name: '', type: 'address', internalType: 'address' },
      { name: '', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nonces',
    inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'REGISTER_IDENTITY_TYPEHASH',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'LINK_SIGNER_TYPEHASH',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'LINK_USER_TYPEHASH',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'IdentityBound',
    inputs: [
      { name: 'identityOwner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'identityDomain', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'identityData', type: 'string', indexed: false, internalType: 'string' },
    ],
  },
  {
    type: 'event',
    name: 'IdentityLinked',
    inputs: [
      { name: 'identityOwner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'policyClient', type: 'address', indexed: true, internalType: 'address' },
      { name: 'policyClientUser', type: 'address', indexed: true, internalType: 'address' },
      { name: 'identityDomain', type: 'bytes32', indexed: false, internalType: 'bytes32' },
    ],
  },
  {
    type: 'event',
    name: 'IdentityUnlinked',
    inputs: [
      { name: 'identityOwner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'policyClient', type: 'address', indexed: true, internalType: 'address' },
      { name: 'policyClientUser', type: 'address', indexed: true, internalType: 'address' },
      { name: 'identityDomain', type: 'bytes32', indexed: false, internalType: 'bytes32' },
    ],
  },
  { type: 'error', name: 'InvalidIdentityDomain', inputs: [] },
  { type: 'error', name: 'InvalidIdentitySubmitter', inputs: [] },
  { type: 'error', name: 'InvalidSignature', inputs: [] },
  { type: 'error', name: 'InvalidUnlinker', inputs: [] },
  {
    type: 'error',
    name: 'LinkAlreadyExists',
    inputs: [
      { name: 'policyClient', type: 'address', internalType: 'address' },
      { name: 'clientUser', type: 'address', internalType: 'address' },
      { name: 'identityDomain', type: 'bytes32', internalType: 'bytes32' },
    ],
  },
  { type: 'error', name: 'NoEmptyDomainsArray', inputs: [] },
  {
    type: 'error',
    name: 'PolicyClientNotRegistered',
    inputs: [{ name: 'client', type: 'address', internalType: 'address' }],
  },
  { type: 'error', name: 'SignatureExpired', inputs: [] },
  { type: 'error', name: 'TooManyDomainsAtOnce', inputs: [] },
] as const
