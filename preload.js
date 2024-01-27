const { contextBridge, ipcRenderer } = require('electron/renderer');

contextBridge.exposeInMainWorld('uploadFiles', (files) => {
    ipcRenderer.send('uploadFiles', files);
});

contextBridge.exposeInMainWorld('ssh',  {
    connected: async () => {
        return ipcRenderer.invoke('connection-status')
    },
    connect: async (host, username, password, port = 22, privateKey = null) => {
        return ipcRenderer.invoke('connect', [host, username, password, port, privateKey])
    },
    uploadFile: async (directory, files) => {
        return ipcRenderer.invoke('upload-files', [directory, files])
    },
    deleteFile: async (directory, file) => {
        return ipcRenderer.invoke('delete-file', [directory, file])
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

    sessions: {
        get: async () => {
            return ipcRenderer.invoke('retrieve-sessions')
        }
    }
})