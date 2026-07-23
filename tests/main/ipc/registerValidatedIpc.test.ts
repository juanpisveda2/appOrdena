import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { registerValidatedIpc, type IpcMainLike } from '../../../src/main/ipc/registerValidatedIpc';

describe('registerValidatedIpc', () => {
  it('validates renderer payloads before invoking privileged handlers', async () => {
    let registeredListener: ((event: unknown, payload: unknown) => unknown) | undefined;

    const fakeIpcMain: IpcMainLike = {
      handle: (_channel, listener) => {
        registeredListener = listener;
      }
    };

    registerValidatedIpc({
      ipcMainLike: fakeIpcMain,
      definition: {
        channel: 'test:validated',
        requestSchema: z.object({ value: z.number().int().positive() }).strict(),
        handle: ({ value }) => value * 2
      }
    });

    expect(registeredListener).toBeTypeOf('function');
    expect(registeredListener?.({}, { value: 4 })).toBe(8);
    expect(() => registeredListener?.({}, { value: 'bad' })).toThrowError();
  });
});
