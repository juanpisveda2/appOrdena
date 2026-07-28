import { join } from 'node:path';
import type { App } from 'electron';
import { initializeApp, type AppBootstrapState, type InitializedApp } from '../bootstrap/initializeApp';

export const ORDENA_APP_NAME = 'Ordena';
export const ORDENA_WINDOWS_APP_ID = 'com.ordena.desktop';
export const ORDENA_DEV_USER_DATA_DIRECTORY_NAME = 'Ordena Dev';

export interface BrowserWindowLike {
  show(): void;
  loadURL(url: string): Promise<void>;
  loadFile(filePath: string): Promise<void>;
  once(event: 'ready-to-show', listener: () => void): void;
  webContents: {
    on(event: 'did-fail-load' | 'render-process-gone', listener: (...args: unknown[]) => void): void;
  };
}

export interface BrowserWindowConstructor {
  new (options: Electron.BrowserWindowConstructorOptions): BrowserWindowLike;
  getAllWindows(): BrowserWindowLike[];
}

export interface AppLike {
  whenReady(): Promise<void>;
  on(event: 'activate' | 'before-quit' | 'window-all-closed', listener: () => void): void;
  quit(): void;
  getVersion(): string;
  getAppPath(): string;
  getPath(name: 'appData' | 'userData'): string;
  setAppUserModelId(id: string): void;
  setName(name: string): void;
  setPath(name: 'userData', path: string): void;
  isPackaged: boolean;
}

export interface DesktopLifecycleDependencies {
  app: AppLike;
  BrowserWindow: BrowserWindowConstructor;
  initializeApplication?: (options: { pathProvider: Pick<App, 'getPath'> }) => InitializedApp;
  registerIpcHandlers: (options: {
    bootstrapState: AppBootstrapState;
    database: InitializedApp['database'];
    getAppVersion: () => string;
  }) => void;
  mainWindowViteDevServerUrl?: string;
  mainWindowRendererViteName?: string;
}

const DESKTOP_STARTUP_DIAGNOSTICS_FLAG = '__ordenaDesktopStartupDiagnosticsRegistered';

export function resolveDesktopWindowIconPath(app: Pick<AppLike, 'getAppPath' | 'isPackaged'>): string {
  if ('isPackaged' in app && app.isPackaged) {
    return join(process.resourcesPath, 'branding', 'windows', 'ordena-icon.ico');
  }

  return join(app.getAppPath(), 'assets', 'branding', 'windows', 'ordena-icon.ico');
}

export function configureDesktopIdentity(app: Pick<AppLike, 'getPath' | 'isPackaged' | 'setAppUserModelId' | 'setName' | 'setPath'>): void {
  app.setName(ORDENA_APP_NAME);
  app.setAppUserModelId(ORDENA_WINDOWS_APP_ID);
  app.setPath('userData', join(app.getPath('appData'), app.isPackaged ? ORDENA_APP_NAME : ORDENA_DEV_USER_DATA_DIRECTORY_NAME));
}

function resolveRendererEntryPath(app: Pick<AppLike, 'getAppPath'>, mainWindowRendererViteName: string): string {
  return join(app.getAppPath(), 'src', 'renderer', '.vite', 'renderer', mainWindowRendererViteName, 'index.html');
}

function registerStartupDiagnostics(): void {
  const diagnosticsProcess = process as NodeJS.Process & {
    [DESKTOP_STARTUP_DIAGNOSTICS_FLAG]?: boolean;
  };

  if (diagnosticsProcess[DESKTOP_STARTUP_DIAGNOSTICS_FLAG]) {
    return;
  }

  diagnosticsProcess[DESKTOP_STARTUP_DIAGNOSTICS_FLAG] = true;

  process.on('uncaughtException', (error: Error) => {
    console.error('[desktop] uncaughtException during startup/runtime.', error);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('[desktop] unhandledRejection during startup/runtime.', reason);
  });
}

export function registerDesktopLifecycle({
  app,
  BrowserWindow,
  initializeApplication = initializeApp,
  registerIpcHandlers,
  mainWindowViteDevServerUrl,
  mainWindowRendererViteName = 'main_window'
}: DesktopLifecycleDependencies): void {
  let initializedApp: InitializedApp | null = null;

  configureDesktopIdentity(app);
  registerStartupDiagnostics();

  const createMainWindow = (): BrowserWindowLike => {
    const window = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 960,
      minHeight: 640,
      show: false,
      autoHideMenuBar: true,
      icon: resolveDesktopWindowIconPath(app),
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    window.once('ready-to-show', () => {
      window.show();
    });

    window.webContents.on('did-fail-load', (...args: unknown[]) => {
      console.error('[desktop] Renderer did-fail-load.', ...args);
    });

    window.webContents.on('render-process-gone', (...args: unknown[]) => {
      console.error('[desktop] Renderer process exited unexpectedly.', ...args);
    });

    if (mainWindowViteDevServerUrl) {
      void window.loadURL(mainWindowViteDevServerUrl).catch((error: unknown) => {
        console.error(`[desktop] Failed to load renderer URL: ${mainWindowViteDevServerUrl}`, error);
      });
    } else {
      const rendererEntryPath = resolveRendererEntryPath(app, mainWindowRendererViteName);

      void window.loadFile(rendererEntryPath).catch((error: unknown) => {
        console.error(`[desktop] Failed to load renderer file: ${rendererEntryPath}`, error);
      });
    }

    return window;
  };

  const startApplication = async (): Promise<void> => {
    initializedApp = initializeApplication({ pathProvider: app });

    registerIpcHandlers({
      bootstrapState: initializedApp.state,
      database: initializedApp.database,
      getAppVersion: () => app.getVersion()
    });

    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  };

  app.whenReady().then(startApplication).catch((error: unknown) => {
    console.error('Failed to start desktop foundation.', error);
    app.quit();
  });

  app.on('before-quit', () => {
    initializedApp?.database.close();
    initializedApp = null;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
