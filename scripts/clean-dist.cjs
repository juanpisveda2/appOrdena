const { existsSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');

for (const directoryName of ['dist', 'out']) {
  const targetPath = join(root, directoryName);

  if (existsSync(targetPath)) {
    rmSync(targetPath, { recursive: true, force: true });
    console.log(`[clean] Removed ${targetPath}`);
  }
}
