"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var _a = require('electron'), contextBridge = _a.contextBridge, ipcRenderer = _a.ipcRenderer;
// Expose the electron API to the renderer
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: function (channel) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            return ipcRenderer.invoke.apply(ipcRenderer, __spreadArray([channel], args, false));
        },
        on: function (channel, func) {
            ipcRenderer.on(channel, function (_event) {
                var args = [];
                for (var _i = 1; _i < arguments.length; _i++) {
                    args[_i - 1] = arguments[_i];
                }
                return func.apply(void 0, args);
            });
        },
        removeListener: function (channel, func) {
            ipcRenderer.removeListener(channel, func);
        }
    },
    // Version info
    getVersionInfo: function () {
        return ipcRenderer.invoke('get-version-info');
    },
    // Update functionality
    checkForUpdates: function () {
        return ipcRenderer.invoke('check-for-updates');
    },
    downloadUpdate: function () {
        return ipcRenderer.invoke('download-update');
    },
    installUpdate: function () {
        return ipcRenderer.invoke('install-update');
    },
    onUpdateStatus: function (callback) {
        ipcRenderer.on('update-status', function (_event, status, info) { return callback(status, info); });
    }
});
//# sourceMappingURL=preload.js.map