const { contextBridge, ipcRenderer } = require('electron');

// Define types for the exposed API
interface VersionInfo {
  appVersion: string;
  aitomicsVersion: string;
}

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

interface ElectronAPI {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, func: (...args: any[]) => void) => void;
    removeListener: (channel: string, func: (...args: any[]) => void) => void;
  };
  getVersionInfo: () => Promise<VersionInfo>;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onUpdateStatus: (callback: (status: string, info?: UpdateInfo | UpdateProgress | string) => void) => void;
}

// Expose the electron API to the renderer
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]): Promise<any> => {
      return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel: string, func: (...args: any[]) => void): void => {
      ipcRenderer.on(channel, (_event: unknown, ...args: any[]) => func(...args));
    },
    removeListener: (channel: string, func: (...args: any[]) => void): void => {
      ipcRenderer.removeListener(channel, func);
    }
  },
  // Version info
  getVersionInfo: (): Promise<VersionInfo> => {
    return ipcRenderer.invoke('get-version-info');
  },
  // Update functionality
  checkForUpdates: (): Promise<void> => {
    return ipcRenderer.invoke('check-for-updates');
  },
  downloadUpdate: (): Promise<void> => {
    return ipcRenderer.invoke('download-update');
  },
  installUpdate: (): Promise<void> => {
    return ipcRenderer.invoke('install-update');
  },
  onUpdateStatus: (callback: (status: string, info?: UpdateInfo | UpdateProgress | string) => void): void => {
    ipcRenderer.on('update-status', (_event: unknown, status: string, info?: any) => callback(status, info));
  }
} as ElectronAPI);

// Add type declarations for the window object
declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {}; 