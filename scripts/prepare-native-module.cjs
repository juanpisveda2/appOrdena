const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const target = process.argv[2];
const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const betterSqlitePackageJsonPath = path.join(
  repoRoot,
  'node_modules',
  'better-sqlite3',
  'package.json'
);
const electronPackageJsonPath = path.join(repoRoot, 'node_modules', 'electron', 'package.json');
const nativeBinaryPath = path.join(
  repoRoot,
  'node_modules',
  'better-sqlite3',
  'build',
  'Release',
  'better_sqlite3.node'
);
const stateDirectoryPath = path.join(repoRoot, 'node_modules', '.cache', 'project-mama');
const stateFilePath = path.join(stateDirectoryPath, 'better-sqlite3-target.json');

const targetConfigurations = {
  node: {
    label: 'Node.js',
    command: ['rebuild', 'better-sqlite3'],
    version: process.version,
    abi: process.versions.modules
  },
  electron: {
    label: 'Electron',
    command: ['exec', 'electron-rebuild', '-f', '-w', 'better-sqlite3'],
    version: getElectronVersion(),
    abi: null
  }
};

main();

function main() {
  if (!targetConfigurations[target]) {
    console.error('[native] Usage: node scripts/prepare-native-module.cjs <node|electron>');
    process.exit(1);
  }

  const betterSqliteVersion = readJson(betterSqlitePackageJsonPath)?.version;

  if (!betterSqliteVersion) {
    console.error('[native] better-sqlite3 is not installed. Run "pnpm install" first.');
    process.exit(1);
  }

  const currentState = readJson(stateFilePath);
  const desiredState = {
    target,
    runtimeVersion: targetConfigurations[target].version,
    runtimeAbi: targetConfigurations[target].abi,
    betterSqliteVersion
  };

  if (!shouldRebuild(currentState, desiredState)) {
    console.log(
      `[native] better-sqlite3 already prepared for ${formatState(desiredState)}. Skipping rebuild.`
    );
    return;
  }

  if (currentState?.target && currentState.target !== target) {
    console.log(
      `[native] Switching better-sqlite3 from ${formatState(currentState)} to ${formatState(desiredState)}.`
    );
  } else {
    console.log(`[native] Preparing better-sqlite3 for ${formatState(desiredState)}.`);
  }

  assertBinaryIsReplaceable();
  runPnpmCommand(targetConfigurations[target].command);
  persistState(desiredState);

  console.log(`[native] better-sqlite3 is ready for ${formatState(desiredState)}.`);
}

function shouldRebuild(currentState, desiredState) {
  if (process.env.FORCE_NATIVE_REBUILD === '1') {
    return true;
  }

  if (!fs.existsSync(nativeBinaryPath)) {
    return true;
  }

  if (!currentState) {
    return true;
  }

  return (
    currentState.target !== desiredState.target ||
    currentState.runtimeVersion !== desiredState.runtimeVersion ||
    currentState.runtimeAbi !== desiredState.runtimeAbi ||
    currentState.betterSqliteVersion !== desiredState.betterSqliteVersion
  );
}

function assertBinaryIsReplaceable() {
  if (process.platform !== 'win32' || !fs.existsSync(nativeBinaryPath)) {
    return;
  }

  const temporaryPath = `${nativeBinaryPath}.unlock-check`;

  try {
    fs.renameSync(nativeBinaryPath, temporaryPath);
    fs.renameSync(temporaryPath, nativeBinaryPath);
  } catch (error) {
    tryRestoreBinary(temporaryPath);

    if (isWindowsLockError(error)) {
      console.error(
        '[native] better-sqlite3 is locked by another process. Close any running Electron dev window, Vitest watch session, or Node process that loaded better-sqlite3, then rerun the command.'
      );
      process.exit(1);
    }

    throw error;
  }
}

function tryRestoreBinary(temporaryPath) {
  if (fs.existsSync(temporaryPath) && !fs.existsSync(nativeBinaryPath)) {
    fs.renameSync(temporaryPath, nativeBinaryPath);
  }
}

function isWindowsLockError(error) {
  return error && ['EBUSY', 'EPERM', 'EACCES'].includes(error.code);
}

function runPnpmCommand(argumentsList) {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? process.env.ComSpec ?? 'cmd.exe' : 'pnpm';
  const commandArguments = isWindows ? ['/d', '/s', '/c', `pnpm ${argumentsList.join(' ')}`] : argumentsList;
  const result = spawnSync(command, commandArguments, {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function persistState(state) {
  fs.mkdirSync(stateDirectoryPath, { recursive: true });
  fs.writeFileSync(stateFilePath, `${JSON.stringify(state, null, 2)}\n`);
}

function getElectronVersion() {
  const installedElectronPackageJson = readJson(electronPackageJsonPath);

  if (installedElectronPackageJson?.version) {
    return installedElectronPackageJson.version;
  }

  const packageJson = readJson(packageJsonPath);

  return packageJson?.devDependencies?.electron ?? packageJson?.dependencies?.electron ?? 'unknown';
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function formatState(state) {
  const runtime = state.target === 'electron' ? state.runtimeVersion : `${state.runtimeVersion} (ABI ${state.runtimeAbi})`;

  return `${state.target}/${runtime}`;
}
