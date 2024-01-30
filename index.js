const { app, BrowserWindow, ipcMain } = require('electron')
const { dialog } = require('electron');

const fs = require('fs')
const path = require('node:path')
const {NodeSSH} = require('node-ssh')


let connection = null;

const sessionsFile = 'sessions.json';
let sessionsPath = path.join(__dirname, sessionsFile);
let window;

let _clog = console.log;
console.log = function(...args) { _clog(...args); }

function createWindow() {
    window = new BrowserWindow({
        width: 900,
        height: 700,
        transparent: true,
        movable: true,
        titleText: 'SSH Client',
        titleBarOverlay: true,
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            preload: path.join(__dirname, "preload.js") // use a preload script
        }
    });
    window.setWindowButtonVisibility(true);
    window.loadFile('./index.html')
        .catch((err) => console.error(err));
}

app.whenReady().then(() => {
    createWindow()
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
    // Check for the existence of the sessions file.
    // If it does not exist, create it.
    if (!fs.existsSync(sessionsPath)) {
        console.log("Creating sessions file");
        fs.writeFile(sessionsPath, JSON.stringify([]), (err) => {
            if (err) throw err;
        })
    }
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit()
})

/** Event handler for the 'select files' dialog menu **/
ipcMain.handle('open-files', async () => openFiles());

/** Event handler for listing files on the remote server **/
ipcMain.handle('list-files', async (_, directory) => listFiles(directory));

/** Event handler for listing the current working directory on the remote server **/
ipcMain.handle('list-directory', async () => listDirectory());

/** Event handler for deleting files on the remote server **/
ipcMain.handle('delete-file', async (_, directory, fileName) => deleteFile(directory, fileName));

/** Event handler for retrieving the successful sessions in sessions.json **/
ipcMain.handle('retrieve-sessions', retrieveSessions);

/** Event handler for retrieving the status of the current SSH connection **/
ipcMain.handle('connection-status', connectionStatus)

/** Event handler for attempting to connect to a remote server **/
ipcMain.handle('connect', async (_, ...args) => sshConnect(...args))

/** Event handler for uploading multiple files **/
ipcMain.handle('upload-files', async (_, directory, files) => uploadFiles(directory, files))

/** Event handler for creating a directory on the remote server **/
ipcMain.handle('create-directory', async (_, directory, title) => createDirectory(directory, title));

ipcMain.handle('get-file-info', async (_, directory, file) => getFileInfo(directory, file));

/** Event handler for resizing the main window **/
ipcMain.on('window-resize', (_, width, height) => window.setSize(width, height))

/** Event handler for minimizing the main window **/
ipcMain.on('window-minimize', () => window.minimize());

ipcMain.on('current-session', (event) => {
    event.returnValue = {username: connection.username, host: connection.host, port: connection.port};
})

ipcMain.on('log', (_, args) => {
    console.log(args);
});

/**
 * Method for creating a directory on the remote server.
 * @param {string} directory The directory in which to create the new directory.
 * @param {string} name The name of the new directory.
 * @returns {Promise<*>} Resolved promise when directory creation is successful; rejected promise when an error occurs.
 */
async function createDirectory(directory, name) {
    return new Promise((resolve, reject) => {
        if (connectionStatus()) {
            getCurrentSession().execCommand(`cd ~ && cd ${directory} && mkdir ${name}`)
                .then(result => resolve())
                .catch(err => reject(err));
        } else reject('Not connected');
    })
}

async function getFileInfo(directory, file) {
    return new Promise((resolve, reject) => {
        if (connectionStatus()) {
            getCurrentSession().execCommand(`cd ~ && cd ${directory} && ls -l -d ${file}`)
                .then(result => resolve(result.stdout))
                .catch(err => reject(err));
        } else reject('Not connected');
    })
}

/**
 * Method for uploading files to the remote server.
 * @param {string} directory The directory in which to upload the files.
 * @param {string[]} files The files to upload to the remote server.
 * @returns {Promise<*>} Resolved promise when file uploading is successful; rejected promise when an error occurs.
 */
async function uploadFiles(directory, files) {
    return new Promise((resolve, reject) => {
        if (connectionStatus()) {
            connection.ssh.putFiles(files.map(path => {
                return {local: path, remote: directory + '/' + path.split('/').pop()}
            }))
                .then(result => resolve(true))
                .catch(e => reject(e))
        } else resolve('Not connected');
    })
}

function connectionStatus() {
    return currentSession()?.ssh?.isConnected() || false;
}


async function sshConnect(host, username, password, port = 22, privateKey = null) {
    return new Promise((resolve, reject) => {
        if (connectionStatus() && (connection.host === host && connection.username === username && connection.port === port)) {
            console.log("Already connected");
            return resolve();
        }

        console.log("Attempting to connect to " + host + ":" + port + " with username " + username + " and password " + password);
        connection = session(host, username, password, port, privateKey);
        connection.ssh.connect({
            host: connection.host,
            privateKey: connection.privateKey,
            username: connection.username,
            password: connection.password,
            port: connection.port,
            tryKeyboard: true,

            onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
                finish([connection.password]);
            }
        })
            .then(ssh => {
                updateSessions(connection);
                resolve();
            })
            .catch(err => reject(err));
    })
}

/**
 * Method for opening the 'select file' dialog menu.
 * @returns {Promise<*>} A promise that resolves to string with files, separated by \n.
 * Rejects when there's no active connection.
 */
async function openFiles() {
    return new Promise((resolve, reject) => {
        if (connectionStatus()) {
            dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
                .then(result => resolve(result.filePaths))
                .catch(err => reject(err));
        } else reject('Not connected');
    })
}


/**
 * Method to list the files in a directory.
 * @param {string} directory The directory in which to list the files.
 * @returns {Promise<string>} A promise that resolves to a string containing the files in the directory.
 * Rejects when the directory is not a string or when there's no active connection, or an error occurs.
 */
async function listFiles(directory) {
    return new Promise((resolve, reject) => {

        // Check whether the provided argument is a string or not.
        // If this is not the case, do not proceed.
        if (! (typeof directory === 'string' || directory instanceof String))
            return reject('Argument \'directory\' is not a string');

        // Check whether there's an active connection.
        // If this is the case, we move to the provided directory and list its files
        // We return the retrieved files in a 'listFilesResponse' event, with two arguments:
        // arg[0]: the absolute path of the directory
        if (connectionStatus()) {
            return currentSession().ssh.execCommand(`cd ~ && cd ${directory} && ls`)
                .then(result => resolve(result.stdout))
                .catch(err => reject(err));
        } else reject('Not connected');
    });

}

async function listDirectory() {
    return new Promise((resolve, reject) => {
        if (connectionStatus()) {
            getCurrentSession().execCommand('pwd')
                .then(result => resolve(result.stdout))
                .catch(err => reject(err));
        } else reject('Not connected')
    })
}

async function deleteFile(directory, file) {
    return new Promise((resolve, reject) => {
        if (connectionStatus()) {
            console.error("Attempting to remove file: " + file + " from directory: " + directory);

            // Remove file.
            return getCurrentSession().execCommand(`cd ~ && cd ${directory} && rm -r '${file}'`)
                .then(result => resolve())
                .catch(err => reject(err));
        } else reject('Not connected');
    });
}

/**
 * Method for retrieving the current SSH session.
 * Currently returns the NodeSSH object.
 * Future proofing for possible changes.
 * @returns {NodeSSH} the current SSH session.
 */
function getCurrentSession() {
    return connection.ssh;
}

function currentSession() {
    return connection;
}

/**
 * Method for creating a new SSH session.
 * @param {string} host The host for the SSH session. Can be either an IP address or a domain name.
 * @param {string} username The username for the SSH session.
 * @param {string} password The password for the SSH session.
 * @param {number} port The port for the SSH session. Default is 22.
 * @param {string} privateKey The private key for the SSH session. Default is null.
 * @returns {{ssh: NodeSSH, port: number, host: string, username: string, password: string, privateKey: string}}
 */
function session(host, username, password, port = 22, privateKey = null) {
    return {
        ssh: new NodeSSH(),
        port: port,
        host: host,
        username: username,
        password: password,
        privateKey: privateKey,
    }
}

async function retrieveSessions() {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(__dirname, 'sessions.json'), (err, data) => {
            if (err)
                reject(err);

            let content = {};

            try { content = JSON.parse(data.toString()); } catch (e) {}

            resolve(content);
        });
    });
}

/**
 * Method for updating the sessions file with a new successful connection.
 * @param {{host: string, username: string, password: string, port: number, privateKey: string}} connection
 * The connection object to update the sessions file with.
 */
function updateSessions(connection) {

    // Get previous data
    fs.readFile(sessionsPath, (error, data) => {
        if (error)
            throw error;
        // Parse previous data
        let sessions = JSON.parse(data.toString());

        // Check if the connection is already in the sessions file, if not, add it.
        if (!sessions.some(session => session.host === connection.host && session.username === connection.username)) {

            // Add new data
            sessions.push({
                host: connection.host,
                username: connection.username,
                password: connection.password,
                port: connection.port,
                privateKey: connection.privateKey
            });

            // Write back to file
            fs.writeFile(sessionsPath, JSON.stringify(sessions), (err) => {
                if (err) throw err;
            })
        }
    })
}