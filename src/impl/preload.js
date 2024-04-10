const { contextBridge, ipcRenderer } = require('electron/renderer');
const hljs = require('highlight.js'); // Highlight.js

const path = require('path');


const { version, name } = require('../../package.json');


/**
 * Object containing all the definitions that are exposed to the renderer process.
 */
const __app_defs = {
    version: version,
    name: name,
    os: {
        platform: process.platform,
        isMac: process.platform === 'darwin',
        isWindows: process.platform === 'win32',
        isLinux: process.platform === 'linux',
    },
    config: {
        /** @param {string} file */
        get: (file) => ipcRenderer.invoke('get-config', file),
    },
    auth: {
        canRequestFingerprint: () => __app_defs.os.isMac && ipcRenderer.sendSync('can-prompt-touch-id'),
        requestFingerprint: async (message) => ipcRenderer.invoke('request-touch-id-auth', message),
    },
    logger: {
        log: (message, ...args) => {
            ipcRenderer.send('log', message, ...args);
        },
        error: (message, ...args) => {
            ipcRenderer.send('log', `\x1b[38;2;200;0;0m${message}\x1b[0m`, args);
        }
    },
    terminal: {
        execute: async (command) => ipcRenderer.invoke('external-terminal-send-command', command),
    },
    window: {
        resize: (width, height) => ipcRenderer.send('resize-window', width, height),
    }
};


hljs.addPlugin({
    "after:highlight": (params) => {
        const openTags = [];

        params.value = params.value.replace(/(<span [^>]+>)|(<\/span>)|(\n)/g, match => {
            if (match === "\n") {
                return "</span>".repeat(openTags.length) + "\n" + openTags.join("");
            }

            if (match === "</span>") {
                openTags.pop();
            } else {
                openTags.push(match);
            }

            return match;
        });
    },
});

/**
 * Methods for interacting with the SSH connection.
 */
contextBridge.exposeInMainWorld('ssh',  {
    connected: async () => ipcRenderer.invoke('connection-status'),
    /** @param {ISSHSession} configuration The configuration to provide */
    connect: async (configuration) => {
        return ipcRenderer.invoke('connect', configuration)
    },
    /** @param {string} remoteDirectory
     *  @param {string[]} localFilePaths */
    uploadFiles: async (remoteDirectory, localFilePaths) => {
        return ipcRenderer.invoke('upload-files', remoteDirectory, localFilePaths)
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

    /** @returns {Promise<string[]>} */
    selectFiles: async (properties) => ipcRenderer.invoke('open-files', properties),

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
        ipcRenderer.invoke('move-file', fileName, srcPath, dstPath),

    /** @param {string} directory
     *  @param {string} file */
    getFileInfo: async (directory, file) => ipcRenderer.invoke('get-file-info', directory, file),

    sessions: {
        /** @returns {Promise<ISSHSession[]>} */
        get: async () => ipcRenderer.invoke('retrieve-sessions'),
        currentSession: () => ipcRenderer.sendSync('current-session'),
        /** @param {string} host
         *  @param {string} username
         *  @param {number} port */
        delete: async (host, username, port) => ipcRenderer.invoke('delete-session', host, username, port)
    }
})

contextBridge.exposeInMainWorld('events', {
    on: (event, callback) => ipcRenderer.on(event, (e, ...args) => callback(...args))
});

contextBridge.exposeInMainWorld('extWindows', {
    openTerminal: (directory) =>
        ipcRenderer.send('open-terminal', directory),
    openFileEditor: (remoteDirectory, fileName) =>
        ipcRenderer.send('open-file-editor-remote', remoteDirectory, fileName),
});

contextBridge.exposeInMainWorld('localFs', {
    /** @param {string} localAbsolutePath
     * @param {string} content*/
    saveFile: async (localAbsolutePath, content) =>
        ipcRenderer.invoke('localFs:save-file', localAbsolutePath, content),
    renameFile: async (localDirectory, oldFileName, newFileName) =>
        ipcRenderer.invoke('localFs:rename-file', localDirectory, oldFileName, newFileName),
    listFiles: async (directory) =>
        ipcRenderer.invoke('localFs:list-files', directory),
})

contextBridge.exposeInMainWorld('path', {
    sep: path.sep,
    delimiter: path.delimiter,
    join: (...paths) => path.join(...paths),
    resolve: (...paths) => path.resolve(...paths),

    /**
     * Dissect a file path into its components
     * @param {string} filePath - The file path to dissect
     * @returns {string[]} - An array of path segments
     */
    dissect: (filePath) => {
        // Split the directory path using the path separator
        let segments = filePath
            .split(path.sep)
            .filter(segment => segment !== '');

        segments.unshift('/')

        return segments;
    }
})


contextBridge.exposeInMainWorld('app', __app_defs);

/**
 * Expose the code highlighting function(s) to the rendering process with ID 1024 (0x400)
 */
contextBridge.exposeInMainWorld('codeHighlighting', {
    highlight: (code, lang) => hljs.highlight(code, { language: lang }).value
})