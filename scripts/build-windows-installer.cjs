const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appName = 'Ordena';
const appDescription = 'Gestión de stock y ventas';
const appPublisher = 'Ordena';
const appId = 'com.ordena.desktop';
const exeName = 'Ordena.exe';
const setupBaseName = `${appName}-Setup-${packageJson.version}`;
const packageRoots = [path.join(root, 'dist', 'package'), path.join(root, 'dist')];
const installerOutputDir = path.join(root, 'dist', 'installer');
const iconFile = path.join(root, 'assets', 'branding', 'windows', 'ordena-icon.ico');
const scriptFile = path.join(root, 'scripts', 'inno', 'ordena-installer.iss');

main();

function main() {
  const isccPath = resolveIsccPath();
  const packagedAppDir = resolvePackagedAppDirectory();
  const packagedExePath = path.join(packagedAppDir, exeName);

  if (!fs.existsSync(packagedExePath)) {
    fail(`Packaged executable not found: ${packagedExePath}`);
  }

  fs.mkdirSync(installerOutputDir, { recursive: true });

  const result = spawnSync(
    isccPath,
    [
      `/DAppName=${appName}`,
      `/DAppDescription=${appDescription}`,
      `/DAppPublisher=${appPublisher}`,
      `/DAppVersion=${packageJson.version}`,
      `/DAppId=${appId}`,
      `/DExeName=${exeName}`,
      `/DSourceDir=${packagedAppDir}`,
      `/DOutputDir=${installerOutputDir}`,
      `/DSetupBaseName=${setupBaseName}`,
      `/DIconFile=${iconFile}`,
      scriptFile
    ],
    {
      cwd: root,
      stdio: 'inherit'
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const installerPath = path.join(installerOutputDir, `${setupBaseName}.exe`);

  if (!fs.existsSync(installerPath)) {
    fail(`Installer was not generated at ${installerPath}`);
  }

  console.log(`[installer] Created ${installerPath}`);
}

function resolvePackagedAppDirectory() {
  for (const packageRoot of packageRoots) {
    if (!fs.existsSync(packageRoot)) {
      continue;
    }

    const entries = fs
      .readdirSync(packageRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.includes('win32'))
      .map((entry) => path.join(packageRoot, entry.name));

    const match = entries.find((directoryPath) => fs.existsSync(path.join(directoryPath, exeName)));

    if (match) {
      return match;
    }
  }

  fail(`Could not find a packaged Windows app with ${exeName} under ${packageRoots.join(' or ')}.`);
}

function resolveIsccPath() {
  const configuredPath = process.env.INNO_SETUP_COMPILER || process.env.ISCC_EXE;
  const candidatePaths = [
    configuredPath,
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files (x86)\\Inno Setup 5\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 5\\ISCC.exe',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Inno Setup 6', 'ISCC.exe') : null
  ].filter(Boolean);

  for (const candidatePath of candidatePaths) {
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  fail(
    'Inno Setup compiler not found. Install Inno Setup 6 or set INNO_SETUP_COMPILER to ISCC.exe. Suggested command: winget install JRSoftware.InnoSetup'
  );
}

function fail(message) {
  console.error(`[installer] ${message}`);
  process.exit(1);
}
