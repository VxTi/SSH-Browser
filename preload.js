const { contextBridge, ipcRenderer } = require('electron/renderer');

let availableLanguages = null

/**
 * Methods for interacting with the SSH connection.
 */
contextBridge.exposeInMainWorld('ssh',  {
    connected: async () => ipcRenderer.invoke('connection-status'),
    /** @param {string} host
     *  @param {string} username
     *  @param {string} password
     *  @param {number} port
     *  @param {string} privateKey
     *  @param {string} passphrase */
    connect: async (host, username, password, port = 22, privateKey = null, passphrase = null) => {
        return ipcRenderer.invoke('connect', host, username, password, port, privateKey, passphrase)
    },
    /** @param {string} directory
     *  @param {string[]} files */
    uploadFiles: async (directory, files) => {
        return ipcRenderer.invoke('upload-files', directory, files)
    },
    /** @param {string} directory
     *  @param {string} file */
    deleteFile: async (directory, file) => {
        return ipcRenderer.invoke('delete-file', directory, file)
    },

    createDirectory: async (directory, name) => {
        return ipcRenderer.invoke('create-directory', directory, name)
    },

    /** @param {string} absolutePath
     * @param {string} fileName
     */
    downloadFile: async (absolutePath, fileName) => {
        return ipcRenderer.invoke('download-file', absolutePath, fileName)
    },

    /** @param {string} directory
     * @param {string} file
     * @param {string} permissions
     */
    grantPermissions: async (directory, file, permissions) => ipcRenderer.invoke('grant-permissions', directory, file, permissions),

    selectFiles: async () => ipcRenderer.invoke('open-files'),

    startingDir: async () => ipcRenderer.invoke('starting-directory'),

    /** @param {string} directory */
    listFiles: async (directory) => ipcRenderer.invoke('list-files', directory),

    /** @param {string} directory
     *  @param {string} file
     *  @param {string} newName */
    renameFile: async (directory, file, newName) =>
        ipcRenderer.invoke('rename-file', directory, file, newName)
    ,

    /** @param {string} fileName
     * @param {string} srcPath
     * @param {string} dstPath
     */
    moveFile: async (fileName, srcPath, dstPath) =>
        ipcRenderer.invoke('move-file', fileName, srcPath, dstPath)
    ,

    /** @param {string} directory
     *  @param {string} file */
    getFileInfo: async (directory, file) => ipcRenderer.invoke('get-file-info', directory, file),

    sessions: {
        get: async () => ipcRenderer.invoke('retrieve-sessions'),
        currentSession: () => ipcRenderer.sendSync('current-session'),
        delete: async (host, username) => ipcRenderer.invoke('delete-session', host, username)
    }
})

contextBridge.exposeInMainWorld('events', {
    on: (event, callback) => ipcRenderer.on(event, (e, ...args) => callback(...args))
});

contextBridge.exposeInMainWorld('terminal', {
    execute: async (command) => ipcRenderer.invoke('cmd', command)
});

contextBridge.exposeInMainWorld('logger', {
    /** @param {string} message
     *  @param {...any} args */
    log: (message, ...args) => {
        ipcRenderer.send('log', message, args);
    },
    error: (message, ...args) => {
        ipcRenderer.send('log', `\x1b[38;2;200;0;0m${message}\x1b[0m`, args);
    }
})

contextBridge.exposeInMainWorld('config', {
    /** @param {string} file */
    get: async (file) => ipcRenderer.invoke('get-config', file),

    getLang: (key) => {
        if (!availableLanguages)
            availableLanguages = ipcRenderer.sendSync('get-languages')
        let language = availableLanguages.hasOwnProperty(localStorage.language) ?
            availableLanguages[localStorage.language] : availableLanguages['lang_en'];
        return language.hasOwnProperty(key) ? language[key] : key;
    }
})