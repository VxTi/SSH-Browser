const { contextBridge, ipcRenderer } = require('electron/renderer');

contextBridge.exposeInMainWorld('ssh',  {
    connected: async () => {
        return ipcRenderer.invoke('connection-status')
    },
    connect: async (host, username, password, port = 22, privateKey = null) => {
        return ipcRenderer.invoke('connect', host, username, password, port, privateKey)
    },
    uploadFile: async (directory, files) => {
        return ipcRenderer.invoke('upload-files', directory, files)
    },
    deleteFile: async (directory, file) => {
        return ipcRenderer.invoke('delete-file', directory, file)
    },
    selectFiles: async () => {
        return ipcRenderer.invoke('open-files')
    },
    listFiles: async (directory) => {
        return ipcRenderer.invoke('list-files', directory)
    },
    currentDirectory: async () => {
        return ipcRenderer.invoke('list-directory')
    },
    getFileInfo: async (directory, file) => {
        return ipcRenderer.invoke('get-file-info', directory, file)
    },
    sessions: {
        get: async () => {
            return ipcRenderer.invoke('retrieve-sessions')
        },
        currentSession: () => {
            return ipcRenderer.sendSync('current-session');
        }
    }
})

/**
 * Methods for controlling the window.
 */
contextBridge.exposeInMainWorld('frame', {
    minimize: () => {
        ipcRenderer.send('window-minimize')
    },
    maximize: () => {
        ipcRenderer.send('window-maximize')
    },
    resize: (x, y) => {
        ipcRenderer.send('window-resize', x, y)
    },
    resizable: (state) => {
        ipcRenderer.send('window-resizable', state)
    },
});

contextBridge.exposeInMainWorld('logger', {
    log: (message, ...args) => {
        ipcRenderer.send('log', message, args);
    }
})