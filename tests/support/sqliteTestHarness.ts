import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import { initializeApp, type InitializedApp } from '../../src/main/bootstrap/initializeApp';
import type { SqliteDatabaseLike } from '../../src/main/db/connection';

export function registerSqliteTestHarness() {
  const cleanupCallbacks: Array<() => void> = [];

  afterEach(() => {
    while (cleanupCallbacks.length > 0) {
      cleanupCallbacks.pop()?.();
    }
  });

  return {
    createInitializedApp(prefix: string): InitializedApp {
      const userDataDirectory = mkdtempSync(join(tmpdir(), prefix));
      const initialized = initializeApp({
        pathProvider: {
          getPath: () => userDataDirectory
        }
      });

      const closeDatabase = makeCloseIdempotent(initialized.database);

      cleanupCallbacks.push(() => {
        closeDatabase();
        rmSync(userDataDirectory, {
          recursive: true,
          force: true,
          maxRetries: 10,
          retryDelay: 50
        });
      });

      return initialized;
    }
  };
}

function makeCloseIdempotent(database: SqliteDatabaseLike) {
  const originalClose = database.close.bind(database);
  let isClosed = false;

  database.close = () => {
    if (isClosed) {
      return;
    }

    isClosed = true;
    originalClose();
  };

  return database.close.bind(database);
}
