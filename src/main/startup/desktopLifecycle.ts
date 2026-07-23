import { join } from 'node:path';
import type { App } from 'electron';
import { initializeApp, type AppBootstrapState, type InitializedApp } from '../bootstrap/initializeApp';

export interface BrowserWindowLike {
  show(): void;
  loadURL(url: string): Promise<void>;
  loadFile(filePath: string): Promise<void>;
  once(event: 'ready-to-show', listener: () => void): void;
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
  isPackaged: boolean;
}

export interface DesktopLifecycleDependencies {
  app: AppLike & Pick<App, 'getPath'>;
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

export function resolveDesktopWindowIconPath(app: Pick<AppLike, 'getAppPath' | 'isPackaged'>): string {
  if ('isPackaged' in app && app.isPackaged) {
    return join(process.resourcesPath, 'windows', 'ordena-icon.ico');
  }

  return join(app.getAppPath(), 'assets', 'branding', 'windows', 'ordena-icon.ico');
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

    if (mainWindowViteDevServerUrl) {
      void window.loadURL(mainWindowViteDevServerUrl);
    } else {
      void window.loadFile(join(__dirname, `../renderer/${mainWindowRendererViteName}/index.html`));
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
