import { join } from 'node:path';

export const DATABASE_FILE_NAME = 'project-mama.sqlite';

export interface AppPathProvider {
  getPath(name: 'userData'): string;
}

export interface AppPaths {
  userDataDirectory: string;
  databaseFilePath: string;
}

interface ResolveAppPathsOptions {
  pathProvider: AppPathProvider;
}

export function resolveAppPaths({ pathProvider }: ResolveAppPathsOptions): AppPaths {
  const userDataDirectory = pathProvider.getPath('userData');

  return {
    userDataDirectory,
    databaseFilePath: join(userDataDirectory, DATABASE_FILE_NAME)
  };
}
