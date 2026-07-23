import { describe, expect, it } from 'vitest';
import { DATABASE_FILE_NAME, resolveAppPaths } from '../../../src/main/platform/appPaths';

describe('resolveAppPaths', () => {
  it('keeps the SQLite file under Electron userData', () => {
    const appPaths = resolveAppPaths({
      pathProvider: {
        getPath: () => 'C:\\Users\\tester\\AppData\\Roaming\\ProjectMama'
      }
    });

    expect(appPaths.userDataDirectory).toBe('C:\\Users\\tester\\AppData\\Roaming\\ProjectMama');
    expect(appPaths.databaseFilePath).toBe(
      'C:\\Users\\tester\\AppData\\Roaming\\ProjectMama\\' + DATABASE_FILE_NAME
    );
  });
});
