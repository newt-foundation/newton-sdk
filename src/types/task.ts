import type { JsonObject, JsonValue } from './rpc';

export type Timestamp = number | string;
export type ChainId = number | string;
export type HexString = `0x${string}`;

export enum TaskStatus {
  Pending = 'Pending',
  Processing = 'Processing',
  Success = 'Success',
  Failed = 'Failed',
  Timeout = 'Timeout'
}

export interface IntentPayload extends JsonObject {}

export type TaskIntent = string | IntentPayload;

export interface CreateTaskRequest<TIntent extends TaskIntent = TaskIntent> {
  policy_client: string;
  intent: TIntent;
  intent_signature: string;
  quorum_number: number;
  quorum_threshold_percentage: number;
  wasm_args?: JsonValue;
  timeout?: number;
  use_two_phase?: boolean;
  proof_cid?: string;
  encrypted_data_refs?: string[];
}

export type SendTaskRequest<TIntent extends TaskIntent = TaskIntent> = CreateTaskRequest<TIntent>;
export type SimulateTaskRequest<TIntent extends TaskIntent = TaskIntent> = CreateTaskRequest<TIntent>;

export interface OperatorError {
  operator: string;
  error: string;
}

export interface SignatureData extends JsonObject {
  signature: string;
  signers?: JsonValue;
  non_signers?: JsonValue;
  apk?: string;
}

export interface AggregationResponse extends JsonObject {
  signature?: string;
  signers?: JsonValue;
  quorum_numbers?: JsonValue;
}

export interface TaskRecord<TIntent extends TaskIntent = TaskIntent> extends JsonObject {
  task_id?: string;
  policy_client?: string;
  intent?: TIntent;
  proof_cid?: string;
  status?: TaskStatus;
}

export interface CreateTaskResponse<
  TTask extends JsonValue | TaskRecord = TaskRecord,
  TTaskResponse extends JsonValue = JsonValue
> {
  task_id: string;
  status: TaskStatus;
  aggregation_response?: AggregationResponse | JsonValue;
  signature_data?: SignatureData | JsonValue;
  task?: TTask;
  task_response?: TTaskResponse;
  reference_block?: number;
  expiration?: Timestamp;
  validate_calldata?: HexString | string;
  error?: string;
  operator_errors?: Record<string, string> | OperatorError[];
  timestamp: Timestamp;
}

export interface SendTaskResponse {
  task_id: string;
  subscription_topic: string;
  message: string;
  timestamp: Timestamp;
}

export interface SimulatePolicyRequest<TIntent extends TaskIntent = TaskIntent> {
  intent: TIntent;
  policy_task_data: JsonValue;
  chain_id?: ChainId;
}

export interface SimulatePolicyResponse<TResult extends JsonValue = JsonValue> {
  success: boolean;
  result?: TResult;
  error?: string;
  details?: JsonValue;
}

export interface StoreEncryptedSecretsResponse extends JsonObject {
  encrypted_data_refs?: JsonValue;
  refs?: JsonValue;
  message?: string;
}

export interface WebhookRegistrationRequest extends JsonObject {
  url: string;
  events?: string[];
  secret?: string;
  metadata?: JsonObject;
}

export interface WebhookRegistrationResponse extends JsonObject {
  webhook_id: string;
  active: boolean;
  timestamp?: Timestamp;
}

export interface WebhookUnregisterRequest extends JsonObject {
  webhook_id: string;
}

export interface WebhookUnregisterResponse extends JsonObject {
  webhook_id: string;
  removed: boolean;
  timestamp?: Timestamp;
}

export interface TaskUpdate<TPayload extends JsonValue = JsonValue> extends JsonObject {
  topic: string;
  task_id?: string;
  status?: TaskStatus;
  payload?: TPayload;
  error?: string;
  timestamp?: Timestamp;
}
