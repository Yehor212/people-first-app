declare module "cloudflare:workers" {
  export class WorkflowEntrypoint<Env = unknown, _Params = unknown> {
    readonly env: Env;
    readonly ctx: unknown;
  }

  export interface WorkflowEvent<Params = unknown> {
    readonly payload: Params;
  }

  export interface WorkflowStep {
    do<Result>(
      name: string,
      callback: () => Result | Promise<Result>,
    ): Promise<Result>;
    do<Result>(
      name: string,
      config: unknown,
      callback: () => Result | Promise<Result>,
    ): Promise<Result>;
    sleep(name: string, duration: string): Promise<void>;
    waitForEvent?<Result>(
      name: string,
      options: { type: string; timeout?: string },
    ): Promise<{ payload: Result }>;
  }
}
