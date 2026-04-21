import { AttesterClient, type AttesterClientOptions, type CreateSessionOptions } from './client/attester';
import { GatewayClient, type GatewayClientOptions, type GatewaySubscription, type TaskSubscriptionOptions } from './client/gateway';
import { ProofClient, type ProofClientOptions } from './client/proof';
import type {
  AttesterSession,
  CreateTaskRequest,
  CreateTaskResponse,
  RegisterRequest,
  SendTaskRequest,
  SendTaskResponse,
  StoreProofResponse,
  TaskUpdate
} from './types';
import { NewtonSdkError } from './client/utils';

export interface NewtonClientOptions {
  gateway: GatewayClient | GatewayClientOptions;
  attester?: AttesterClient | AttesterClientOptions;
  proof?: ProofClient | ProofClientOptions;
}

export interface TaskLifecycleOptions<TSync extends boolean = boolean> {
  /** Base64 BCS-serialized TLSNotary Presentation. */
  proof: string;
  /** Task request. proof_cid is filled from the stored proof unless already provided. */
  task: TSync extends true ? CreateTaskRequest : SendTaskRequest;
  /** Use newt_sendTask when true; otherwise use newt_createTask. */
  async?: TSync;
  /** Optional MPC-TLS session registration before storing proof/submitting task. */
  session?: RegisterRequest;
  sessionOptions?: CreateSessionOptions;
}

export interface SyncTaskLifecycleResult<TResponse extends CreateTaskResponse = CreateTaskResponse> {
  mode: 'sync';
  proof: StoreProofResponse;
  session?: AttesterSession;
  task: TResponse;
}

export interface AsyncTaskLifecycleResult<TResponse extends SendTaskResponse = SendTaskResponse> {
  mode: 'async';
  proof: StoreProofResponse;
  session?: AttesterSession;
  task: TResponse;
}

export type TaskLifecycleResult = SyncTaskLifecycleResult | AsyncTaskLifecycleResult;

export class NewtonClient {
  public readonly gateway: GatewayClient;
  public readonly attester: AttesterClient | undefined;
  public readonly proof: ProofClient | undefined;

  public constructor(options: NewtonClientOptions) {
    this.gateway = options.gateway instanceof GatewayClient ? options.gateway : new GatewayClient(options.gateway);
    this.attester = options.attester
      ? options.attester instanceof AttesterClient
        ? options.attester
        : new AttesterClient(options.attester)
      : undefined;
    this.proof = options.proof
      ? options.proof instanceof ProofClient
        ? options.proof
        : new ProofClient(options.proof)
      : undefined;
  }

  public createSession(request: RegisterRequest, options?: CreateSessionOptions): Promise<AttesterSession> {
    return this.requireAttester().createSession(request, options);
  }

  public storeProof(proof: string): Promise<StoreProofResponse> {
    return this.requireProof().storeProof({ proof });
  }

  public createTask<TResponse extends CreateTaskResponse = CreateTaskResponse>(
    request: CreateTaskRequest
  ): Promise<TResponse> {
    return this.gateway.createTask<TResponse>(request);
  }

  public sendTask<TResponse extends SendTaskResponse = SendTaskResponse>(request: SendTaskRequest): Promise<TResponse> {
    return this.gateway.sendTask<TResponse>(request);
  }

  public subscribeToTask<TUpdate = TaskUpdate>(
    subscriptionTopic: string,
    options?: TaskSubscriptionOptions<TUpdate>
  ): GatewaySubscription {
    return this.gateway.subscribeToTask<TUpdate>(subscriptionTopic, options);
  }

  public async submitTaskWithProof<TResponse extends CreateTaskResponse = CreateTaskResponse>(
    options: TaskLifecycleOptions<false>
  ): Promise<SyncTaskLifecycleResult<TResponse>>;
  public async submitTaskWithProof<TResponse extends SendTaskResponse = SendTaskResponse>(
    options: TaskLifecycleOptions<true>
  ): Promise<AsyncTaskLifecycleResult<TResponse>>;
  public async submitTaskWithProof(options: TaskLifecycleOptions<boolean>): Promise<TaskLifecycleResult> {
    const session = options.session ? await this.requireAttester().createSession(options.session, options.sessionOptions) : undefined;
    const proof = await this.requireProof().storeProof({ proof: options.proof });
    const taskRequest = {
      ...options.task,
      proof_cid: options.task.proof_cid ?? proof.cid
    };

    if (options.async) {
      const task = await this.gateway.sendTask(taskRequest);
      return { mode: 'async', proof, ...(session ? { session } : {}), task };
    }

    const task = await this.gateway.createTask(taskRequest);
    return { mode: 'sync', proof, ...(session ? { session } : {}), task };
  }

  public subscribeToLifecycleResult<TUpdate = TaskUpdate>(
    result: AsyncTaskLifecycleResult,
    options?: TaskSubscriptionOptions<TUpdate>
  ): GatewaySubscription {
    return this.subscribeToTask(result.task.subscription_topic, options);
  }

  private requireAttester(): AttesterClient {
    if (!this.attester) {
      throw new NewtonSdkError('Attester client is not configured.');
    }
    return this.attester;
  }

  private requireProof(): ProofClient {
    if (!this.proof) {
      throw new NewtonSdkError('Proof client is not configured.');
    }
    return this.proof;
  }
}
