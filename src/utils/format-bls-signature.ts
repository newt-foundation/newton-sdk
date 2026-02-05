import { AggregationResponse } from '@core/types/task';

/**
 * Converts a byte array to a hex string
 */
function bytesToHex(bytes: number[]) {
  return '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Converts a 64-byte array to a BN254.G1Point struct
 * G1Point { X: uint256, Y: uint256 }
 */
function bytesToG1Point(bytes: number[]) {
  if (bytes.length !== 64) {
    throw new Error(`G1Point must be 64 bytes, got ${bytes.length}`);
  }
  return {
    X: BigInt(bytesToHex(bytes.slice(0, 32))),
    Y: BigInt(bytesToHex(bytes.slice(32, 64))),
  };
}

/**
 * Converts a 128-byte array to a BN254.G2Point struct
 * G2Point { X: uint256[2], Y: uint256[2] }
 * Encoding: X[1] * i + X[0], Y[1] * i + Y[0]
 */
function bytesToG2Point(bytes: number[]) {
  if (bytes.length !== 128) {
    throw new Error(`G2Point must be 128 bytes, got ${bytes.length}`);
  }
  return {
    X: [
      BigInt(bytesToHex(bytes.slice(32, 64))), // X[0]
      BigInt(bytesToHex(bytes.slice(0, 32))), // X[1]
    ],
    Y: [
      BigInt(bytesToHex(bytes.slice(96, 128))), // Y[0]
      BigInt(bytesToHex(bytes.slice(64, 96))), // Y[1]
    ],
  };
}

/**
 * Transforms the server's aggregation_response into the
 * IBLSSignatureChecker.NonSignerStakesAndSignature struct format
 */
export function transformAggregationResponse(aggregationResponse: AggregationResponse) {
  return {
    nonSignerQuorumBitmapIndices: aggregationResponse.non_signer_quorum_bitmap_indices,
    nonSignerPubkeys: aggregationResponse.non_signers_pub_keys_g1.map(bytesToG1Point),
    quorumApks: aggregationResponse.quorum_apks_g1.map(bytesToG1Point),
    apkG2: bytesToG2Point(aggregationResponse.signers_apk_g2),
    sigma: bytesToG1Point(aggregationResponse.signers_agg_sig_g1.g1_point),
    quorumApkIndices: aggregationResponse.quorum_apk_indices,
    totalStakeIndices: aggregationResponse.total_stake_indices,
    nonSignerStakeIndices: aggregationResponse.non_signer_stake_indices,
  };
}
