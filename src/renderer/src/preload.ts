const { contextBridge, ipcRenderer } = require('electron');

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
});

export {}; 