import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  registerDesktopLifecycle,
  resolveDesktopWindowIconPath,
  type AppLike,
  type BrowserWindowLike
} from '../../../src/main/startup/desktopLifecycle';
import type { InitializedApp } from '../../../src/main/bootstrap/initializeApp';

class FakeBrowserWindow implements BrowserWindowLike {
  static instances: FakeBrowserWindow[] = [];
  static windows: FakeBrowserWindow[] = [];

  readonly options: Electron.BrowserWindowConstructorOptions;
  readonly onceHandlers = new Map<string, () => void>();
  loadURL = vi.fn<BrowserWindowLike['loadURL']>().mockResolvedValue();
  loadFile = vi.fn<BrowserWindowLike['loadFile']>().mockResolvedValue();
  show = vi.fn<BrowserWindowLike['show']>();

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
  getPath(name: 'userData'): string;
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
    getPath: vi.fn(() => 'C:\\Users\\tester\\AppData\\Roaming\\ProjectMama'),
    __handlers: eventHandlers
  };
}

function createInitializedApp(): InitializedApp {
  return {
    paths: {
      userDataDirectory: 'C:\\Users\\tester\\AppData\\Roaming\\ProjectMama',
      databaseFilePath: 'C:\\Users\\tester\\AppData\\Roaming\\ProjectMama\\project-mama.sqlite'
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
    FakeBrowserWindow.instances = [];
    FakeBrowserWindow.windows = [];
    vi.restoreAllMocks();
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
    expect(window.loadFile).toHaveBeenCalledWith(
      expect.stringContaining('src\\main\\renderer\\main_window\\index.html')
    );

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

    expect(resolveDesktopWindowIconPath(app)).toBe('C:\\build\\resources\\windows\\ordena-icon.ico');

    Object.defineProperty(process, 'resourcesPath', {
      configurable: true,
      value: originalResourcesPath
    });
  });
});
