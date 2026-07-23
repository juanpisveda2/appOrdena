import { app, BrowserWindow } from 'electron';
import { registerIpc } from './ipc/registerIpc';
import { registerDesktopLifecycle } from './startup/desktopLifecycle';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

registerDesktopLifecycle({
  app,
  BrowserWindow,
  registerIpcHandlers: registerIpc,
  mainWindowViteDevServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
  mainWindowRendererViteName: MAIN_WINDOW_VITE_NAME
});
