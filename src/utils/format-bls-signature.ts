import { decodeAbiParameters, Hex, hexToBytes } from 'viem';

// ABI parameter for decoding signature_data (single tuple = NonSignerStakesAndSignature)
const nonSignerStakesAndSignatureAbi = [
  {
    type: 'tuple',
    name: 'nonSignerStakesAndSignature',
    components: [
      { name: 'nonSignerQuorumBitmapIndices', type: 'uint32[]' },
      {
        name: 'nonSignerPubkeys',
        type: 'tuple[]',
        components: [
          { name: 'X', type: 'uint256' },
          { name: 'Y', type: 'uint256' },
        ],
      },
      {
        name: 'quorumApks',
        type: 'tuple[]',
        components: [
          { name: 'X', type: 'uint256' },
          { name: 'Y', type: 'uint256' },
        ],
      },
      {
        name: 'apkG2',
        type: 'tuple',
        components: [
          { name: 'X', type: 'uint256[2]' },
          { name: 'Y', type: 'uint256[2]' },
        ],
      },
      {
        name: 'sigma',
        type: 'tuple',
        components: [
          { name: 'X', type: 'uint256' },
          { name: 'Y', type: 'uint256' },
        ],
      },
      { name: 'quorumApkIndices', type: 'uint32[]' },
      { name: 'totalStakeIndices', type: 'uint32[]' },
      { name: 'nonSignerStakeIndices', type: 'uint32[][]' },
    ],
  },
];

/**
 * Decode protocol signature_data (ABI-encoded NonSignerStakesAndSignature) into
 * the struct shape expected by validateAttestationDirect.
 */
export function decodeSignatureData(signatureDataHex: Hex) {
  const bytes = signatureDataHex.startsWith('0x') ? hexToBytes(signatureDataHex) : hexToBytes(`0x${signatureDataHex}`);
  const [decoded] = decodeAbiParameters(nonSignerStakesAndSignatureAbi, bytes);
  return decoded;
}
