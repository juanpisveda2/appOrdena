import type { AppBridge } from '../shared/contracts/app';

declare global {
  interface Window {
    app: AppBridge;
  }
}

export {};
