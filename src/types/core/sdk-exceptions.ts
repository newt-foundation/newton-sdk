import { RPCErrorCode } from './exception-types';
import { JsonRpcError } from './json-rpc-types';

function isNil(value: unknown): value is null | undefined {
  return value == null; // This checks for both null and undefined
}

function isJsonRpcErrorCode(value?: unknown): value is RPCErrorCode {
  if (isNil(value)) return false;
  return typeof value === 'number' && Object.values(RPCErrorCode).includes(value);
}

export class NewtonError extends Error {
  __proto__ = Error;

  public code: RPCErrorCode | number;

  public rawMessage: string;

  public data: any;

  constructor(sourceError?: JsonRpcError | null) {
    super();

    const codeNormalized = Number(sourceError?.code);
    this.rawMessage = sourceError?.message || 'Internal error';
    this.code = isJsonRpcErrorCode(codeNormalized) ? codeNormalized : RPCErrorCode.InternalError;
    this.message = `Newton Error: [${this.code}] ${this.rawMessage}`;
    this.data = sourceError?.data || undefined;

    Object.setPrototypeOf(this, NewtonError.prototype);
  }
}
