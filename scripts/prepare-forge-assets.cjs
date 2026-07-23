const { copyFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const vendorDir = join(__dirname, '..', 'node_modules', 'electron-winstaller', 'vendor');

if (!existsSync(vendorDir)) {
  console.log('[forge] electron-winstaller vendor directory not found. Skipping 7-Zip preparation.');
  process.exit(0);
}

const archiveArch = process.arch === 'arm64' ? 'arm64' : 'x64';

for (const extension of ['exe', 'dll']) {
  const sourcePath = join(vendorDir, `7z-${archiveArch}.${extension}`);
  const targetPath = join(vendorDir, `7z.${extension}`);

  if (!existsSync(sourcePath)) {
    console.log(`[forge] Missing ${sourcePath}. Skipping 7-Zip preparation.`);
    process.exit(0);
  }

  copyFileSync(sourcePath, targetPath);
}

console.log(`[forge] Prepared Squirrel 7-Zip binaries for ${archiveArch}.`);
