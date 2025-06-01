import { VersionInfo, UpdateInfo, UpdateProgress } from './electron';

export interface ElectronAPI {
  ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, func: (...args: any[]) => void): void;
    removeListener(channel: string, func: (...args: any[]) => void): void;
  };
  getVersionInfo(): Promise<VersionInfo>;
  checkForUpdates(): Promise<void>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
  onUpdateStatus(callback: (status: string, info?: UpdateInfo | UpdateProgress | string) => void): void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {}; 