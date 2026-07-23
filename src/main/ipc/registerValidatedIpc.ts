import type { ZodTypeAny, infer as Infer } from 'zod';

export interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, payload: unknown) => unknown): void;
}

export interface ValidatedIpcChannel<TRequestSchema extends ZodTypeAny, TResponse> {
  channel: string;
  requestSchema: TRequestSchema;
  handle: (payload: Infer<TRequestSchema>) => Promise<TResponse> | TResponse;
}

interface RegisterValidatedIpcOptions<TRequestSchema extends ZodTypeAny, TResponse> {
  ipcMainLike: IpcMainLike;
  definition: ValidatedIpcChannel<TRequestSchema, TResponse>;
}

export function registerValidatedIpc<TRequestSchema extends ZodTypeAny, TResponse>({
  ipcMainLike,
  definition
}: RegisterValidatedIpcOptions<TRequestSchema, TResponse>): void {
  ipcMainLike.handle(definition.channel, (_event, payload) => {
    const validatedPayload = definition.requestSchema.parse(payload);

    return definition.handle(validatedPayload);
  });
}
