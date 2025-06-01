export interface VersionInfo {
  appVersion: string;
  aitomicsVersion: string;
}

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

export interface ElectronAPI {
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