export type Hex = `0x${string}`;
export type Address = `0x${string}`;

export interface CallEncoded {
  data?: Hex | undefined;
  to: Address;
  value?: bigint | undefined;
}
export interface CallUnencoded {
  abi: Record<string, any>[];
  functionName: string;
  args: unknown[];
  to: Address;
  value?: bigint | undefined;
}

export type Call = CallEncoded | CallUnencoded;
