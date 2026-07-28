import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureDesktopIdentity,
  ORDENA_DEV_USER_DATA_DIRECTORY_NAME,
  registerDesktopLifecycle,
  resolveDesktopWindowIconPath,
  type AppLike,
  type BrowserWindowLike
} from '../../../src/main/startup/desktopLifecycle';
import type { InitializedApp } from '../../../src/main/bootstrap/initializeApp';

class FakeBrowserWindow implements BrowserWindowLike {
  static instances: FakeBrowserWindow[] = [];
  static windows: FakeBrowserWindow[] = [];
  static loadURLMock = vi.fn().mockResolvedValue(undefined);
  static loadFileMock = vi.fn().mockResolvedValue(undefined);

  readonly options: Electron.BrowserWindowConstructorOptions;
  readonly onceHandlers = new Map<string, () => void>();
  readonly webContentsHandlers = new Map<'did-fail-load' | 'render-process-gone', (...args: unknown[]) => void>();
  loadURL = (url: string): Promise<void> => FakeBrowserWindow.loadURLMock(url);
  loadFile = (filePath: string): Promise<void> => FakeBrowserWindow.loadFileMock(filePath);
  show = vi.fn<BrowserWindowLike['show']>();
  webContents = {
    on: vi.fn((event: 'did-fail-load' | 'render-process-gone', listener: (...args: unknown[]) => void) => {
      this.webContentsHandlers.set(event, listener);
    })
  };

  constructor(options: Electron.BrowserWindowConstructorOptions) {
    this.options = options;
    FakeBrowserWindow.instances.push(this);
    FakeBrowserWindow.windows.push(this);
  }

  once(event: 'ready-to-show', listener: () => void): void {
    this.onceHandlers.set(event, listener);
  }

  emit(event: 'ready-to-show'): void {
    this.onceHandlers.get(event)?.();
  }

  static getAllWindows(): FakeBrowserWindow[] {
    return [...FakeBrowserWindow.windows];
  }
}

interface AppDouble extends AppLike {
  getPath(name: 'appData' | 'userData'): string;
  __handlers: Map<string, () => void>;
}

function createAppDouble(): AppDouble {
  const eventHandlers = new Map<string, () => void>();

  return {
    whenReady: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event, listener) => {
      eventHandlers.set(event, listener);
    }),
    quit: vi.fn(),
    getVersion: vi.fn(() => '0.1.0'),
    getAppPath: vi.fn(() => 'C:\\dev\\project-mamá'),
    isPackaged: false,
    getPath: vi.fn((name: 'appData' | 'userData') =>
      name === 'appData' ? 'C:\\Users\\tester\\AppData\\Roaming' : 'C:\\Users\\tester\\AppData\\Roaming\\Ordena Dev'
    ),
    setAppUserModelId: vi.fn(),
    setName: vi.fn(),
    setPath: vi.fn(),
    __handlers: eventHandlers
  };
}

function createInitializedApp(): InitializedApp {
  return {
    paths: {
      userDataDirectory: 'C:\\Users\\tester\\AppData\\Roaming\\Ordena Dev',
      databaseFilePath: 'C:\\Users\\tester\\AppData\\Roaming\\Ordena Dev\\ordena.sqlite'
    },
    database: {
      client: {} as never,
      orm: {} as never,
      exec: vi.fn(),
      prepare: vi.fn(),
      close: vi.fn()
    },
    state: {
      dbReady: true,
      schemaVersion: 1
    }
  };
}

describe('registerDesktopLifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    FakeBrowserWindow.instances = [];
    FakeBrowserWindow.windows = [];
    FakeBrowserWindow.loadURLMock = vi.fn().mockResolvedValue(undefined);
    FakeBrowserWindow.loadFileMock = vi.fn().mockResolvedValue(undefined);
  });

  it('smoke-verifies the desktop startup path with secure window settings and foundation health wiring', async () => {
    const app = createAppDouble();
    const initializedApp = createInitializedApp();
    const initializeApplication = vi.fn(() => initializedApp);
    const registerIpcHandlers = vi.fn();

    registerDesktopLifecycle({
      app,
      BrowserWindow: FakeBrowserWindow,
      initializeApplication,
      registerIpcHandlers,
      mainWindowRendererViteName: 'main_window'
    });

    await Promise.resolve();

    expect(app.setName).toHaveBeenCalledWith('Ordena');
    expect(app.setAppUserModelId).toHaveBeenCalledWith('com.ordena.desktop');
    expect(app.setPath).toHaveBeenCalledWith(
      'userData',
      'C:\\Users\\tester\\AppData\\Roaming\\Ordena Dev'
    );
    expect(initializeApplication).toHaveBeenCalledWith({ pathProvider: app });
    expect(registerIpcHandlers).toHaveBeenCalledWith({
      bootstrapState: initializedApp.state,
      database: initializedApp.database,
      getAppVersion: expect.any(Function)
    });
    expect(FakeBrowserWindow.instances).toHaveLength(1);

    const [window] = FakeBrowserWindow.instances;

    expect(window.options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    });
    expect(window.options.icon).toBe(resolveDesktopWindowIconPath(app));
    expect(FakeBrowserWindow.loadFileMock).toHaveBeenCalledWith(
      'C:\\dev\\project-mamá\\src\\renderer\\.vite\\renderer\\main_window\\index.html'
    );
    expect(window.webContents.on).toHaveBeenCalledWith('did-fail-load', expect.any(Function));
    expect(window.webContents.on).toHaveBeenCalledWith('render-process-gone', expect.any(Function));

    window.emit('ready-to-show');
    expect(window.show).toHaveBeenCalledTimes(1);

    const getAppVersion = registerIpcHandlers.mock.calls[0][0].getAppVersion as () => string;
    expect(getAppVersion()).toBe('0.1.0');

    FakeBrowserWindow.windows = [];
    app.__handlers.get('activate')?.();
    expect(FakeBrowserWindow.instances).toHaveLength(2);

    app.__handlers.get('before-quit')?.();
    expect(initializedApp.database.close).toHaveBeenCalledTimes(1);

    app.__handlers.get('window-all-closed')?.();
    expect(app.quit).toHaveBeenCalledTimes(1);
  });

  it('resolves the runtime window icon from process resources when packaged', () => {
    const app = createAppDouble();
    app.isPackaged = true;

    const originalResourcesPath = process.resourcesPath;

    Object.defineProperty(process, 'resourcesPath', {
      configurable: true,
      value: 'C:\\build\\resources'
    });

    expect(resolveDesktopWindowIconPath(app)).toBe('C:\\build\\resources\\branding\\windows\\ordena-icon.ico');

    Object.defineProperty(process, 'resourcesPath', {
      configurable: true,
      value: originalResourcesPath
    });
  });

  it('uses a dedicated dev userData directory before ready so packaged and local databases stay separated', () => {
    const app = createAppDouble();

    configureDesktopIdentity(app);

    expect(app.setPath).toHaveBeenCalledWith(
      'userData',
      `C:\\Users\\tester\\AppData\\Roaming\\${ORDENA_DEV_USER_DATA_DIRECTORY_NAME}`
    );
  });

  it('logs renderer load failures instead of leaving startup silent', async () => {
    const app = createAppDouble();
    const error = new Error('missing renderer entry');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    FakeBrowserWindow.loadFileMock.mockRejectedValueOnce(error);

    registerDesktopLifecycle({
      app,
      BrowserWindow: FakeBrowserWindow,
      initializeApplication: vi.fn(() => createInitializedApp()),
      registerIpcHandlers: vi.fn(),
      mainWindowRendererViteName: 'main_window'
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalledWith(
      '[desktop] Failed to load renderer file: C:\\dev\\project-mamá\\src\\renderer\\.vite\\renderer\\main_window\\index.html',
      error
    );
  });
});
