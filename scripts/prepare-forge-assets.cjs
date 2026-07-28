const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const brandingDir = path.join(repoRoot, 'assets', 'branding');
const windowsBrandingDir = path.join(brandingDir, 'windows');
const sourceLogoPath = path.join(brandingDir, 'appOrdena-logo.png');
const icoPath = path.join(windowsBrandingDir, 'ordena-icon.ico');
const sourcePngPath = path.join(windowsBrandingDir, 'ordena-icon-source.png');
const masterPngPath = path.join(windowsBrandingDir, 'ordena-icon-master.png');
const genericPngPath = path.join(windowsBrandingDir, 'ordena-icon.png');
const iconSizes = [16, 32, 48, 64, 128, 256];

main();

function main() {
  ensureSourceLogoExists();

  fs.mkdirSync(windowsBrandingDir, { recursive: true });
  fs.copyFileSync(sourceLogoPath, sourcePngPath);
  fs.copyFileSync(sourceLogoPath, masterPngPath);

  generatePngSizes();

  fs.copyFileSync(path.join(windowsBrandingDir, 'ordena-icon-256.png'), genericPngPath);
  fs.writeFileSync(icoPath, buildIco(iconSizes.map((size) => readSizedPng(size))));

  console.log(`[forge] Prepared Windows branding assets at ${windowsBrandingDir}.`);
}

function ensureSourceLogoExists() {
  if (!fs.existsSync(sourceLogoPath)) {
    console.error(`[forge] Missing branding source PNG: ${sourceLogoPath}`);
    process.exit(1);
  }
}

function generatePngSizes() {
  if (process.platform !== 'win32') {
    console.error('[forge] Windows icon generation requires PowerShell on Windows.');
    process.exit(1);
  }

  const command = [
    'Add-Type -AssemblyName System.Drawing',
    `$sourcePath = '${escapeForPowerShell(sourceLogoPath)}'`,
    `$outDir = '${escapeForPowerShell(windowsBrandingDir)}'`,
    '$image = [System.Drawing.Image]::FromFile($sourcePath)',
    'try {',
    `  foreach ($size in @(${iconSizes.join(', ')})) {`,
    '    $bitmap = New-Object System.Drawing.Bitmap $size, $size',
    '    $bitmap.MakeTransparent()',
    '    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)',
    '    try {',
    '      $graphics.Clear([System.Drawing.Color]::Transparent)',
    '      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
    '      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality',
    '      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality',
    '      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality',
    '      $graphics.DrawImage($image, 0, 0, $size, $size)',
    "      $bitmap.Save((Join-Path $outDir ('ordena-icon-' + $size + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)",
    '    } finally {',
    '      $graphics.Dispose()',
    '      $bitmap.Dispose()',
    '    }',
    '  }',
    '} finally {',
    '  $image.Dispose()',
    '}'
  ].join('; ');

  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.stderr.write(result.stderr || '[forge] Failed to generate PNG icon sizes.\n');
    process.exit(result.status ?? 1);
  }
}

function readSizedPng(size) {
  const filePath = path.join(windowsBrandingDir, `ordena-icon-${size}.png`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`[forge] Missing generated icon PNG: ${filePath}`);
  }

  return {
    size,
    buffer: fs.readFileSync(filePath)
  };
}

function buildIco(images) {
  const directorySize = 6 + images.length * 16;
  let offset = directorySize;
  const chunks = [Buffer.alloc(directorySize)];

  chunks[0].writeUInt16LE(0, 0);
  chunks[0].writeUInt16LE(1, 2);
  chunks[0].writeUInt16LE(images.length, 4);

  images.forEach((image, index) => {
    const entryOffset = 6 + index * 16;
    const widthByte = image.size >= 256 ? 0 : image.size;
    const heightByte = image.size >= 256 ? 0 : image.size;

    chunks[0].writeUInt8(widthByte, entryOffset);
    chunks[0].writeUInt8(heightByte, entryOffset + 1);
    chunks[0].writeUInt8(0, entryOffset + 2);
    chunks[0].writeUInt8(0, entryOffset + 3);
    chunks[0].writeUInt16LE(1, entryOffset + 4);
    chunks[0].writeUInt16LE(32, entryOffset + 6);
    chunks[0].writeUInt32LE(image.buffer.length, entryOffset + 8);
    chunks[0].writeUInt32LE(offset, entryOffset + 12);

    chunks.push(image.buffer);
    offset += image.buffer.length;
  });

  return Buffer.concat(chunks);
}

function escapeForPowerShell(value) {
  return value.replace(/'/g, "''");
}
