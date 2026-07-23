import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const forgeOutRoot = process.env.ORDENA_FORGE_OUT_DIR ?? 'C:\\Users\\Usuario\\AppData\\Local\\Temp\\opencode\\project-mama-forge';
const forgeOutDir = resolve(forgeOutRoot, 'artifacts');
const forgeIconDir = resolve(forgeOutRoot, 'branding');
const sourceWindowsIconDir = resolve(__dirname, 'assets', 'branding', 'windows');
const sourceWindowsIconRoot = resolve(__dirname, 'assets', 'branding', 'windows', 'ordena-icon');
const sourceWindowsIconIcoPath = `${sourceWindowsIconRoot}.ico`;
const windowsIconRoot = resolve(forgeIconDir, 'ordena-icon');
const windowsIconIcoPath = `${windowsIconRoot}.ico`;
const windowsIconUrl = process.env.ORDENA_WINDOWS_ICON_URL;

mkdirSync(forgeIconDir, { recursive: true });
copyFileSync(sourceWindowsIconIcoPath, windowsIconIcoPath);

const config = {
  outDir: forgeOutDir,
  packagerConfig: {
    asar: true,
    extraResource: [sourceWindowsIconDir],
    icon: windowsIconRoot
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        authors: 'Project Mamá',
        description: 'Desktop foundation bootstrap for project mamá',
        setupIcon: windowsIconIcoPath,
        ...(windowsIconUrl ? { iconUrl: windowsIconUrl } : {})
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main/main.ts',
            config: 'vite.main.config.ts'
          },
          {
            entry: 'src/preload/preload.ts',
            config: 'vite.preload.config.ts'
          }
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.ts'
          }
        ],
        concurrent: false
      }
    }
  ]
};

export default config;
