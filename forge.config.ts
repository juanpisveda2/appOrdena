import { resolve } from 'node:path';

const sourceBrandingDir = resolve(__dirname, 'assets', 'branding');
const windowsIconBasePath = resolve(sourceBrandingDir, 'windows', 'ordena-icon');

const ignoredPaths = [
  /^\/coverage($|\/)/,
  /^\/dist($|\/)/,
  /^\/docs($|\/)/,
  /^\/out($|\/)/,
  /^\/tests($|\/)/,
  /^\/scripts($|\/)/,
  /^\/.git($|\/)/,
  /\.map$/,
  /^\/.vite\/build\/.*\.map$/,
  /^\/README\.md$/,
  /^\/tsconfig\..+\.json$/,
  /^\/vite\..+\.ts$/,
  /^\/vitest\.config\.ts$/
];

const config = {
  outDir: resolve(__dirname, 'dist'),
  packagerConfig: {
    asar: true,
    executableName: 'Ordena',
    extraResource: [sourceBrandingDir],
    icon: windowsIconBasePath,
    ignore: ignoredPaths,
    prune: true,
    win32metadata: {
      CompanyName: 'Ordena',
      FileDescription: 'Gestión de stock y ventas',
      InternalName: 'Ordena',
      OriginalFilename: 'Ordena.exe',
      ProductName: 'Ordena'
    }
  },
  makers: [],
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
