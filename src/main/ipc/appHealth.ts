import { APP_HEALTH_CHANNEL, type AppHealthResponse } from '../../shared/contracts/app';
import { appHealthRequestSchema } from '../../shared/validation/app';
import type { AppBootstrapState } from '../bootstrap/initializeApp';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export interface AppHealthDependencies {
  getAppVersion: () => string;
  bootstrapState: AppBootstrapState;
}

export function createAppHealthChannel({
  getAppVersion,
  bootstrapState
}: AppHealthDependencies): ValidatedIpcChannel<typeof appHealthRequestSchema, AppHealthResponse> {
  return {
    channel: APP_HEALTH_CHANNEL,
    requestSchema: appHealthRequestSchema,
    handle: () => ({
      ok: true,
      appVersion: getAppVersion(),
      runtime: 'desktop-foundation',
      dbReady: bootstrapState.dbReady,
      schemaVersion: bootstrapState.schemaVersion
    })
  };
}

export { APP_HEALTH_CHANNEL };
