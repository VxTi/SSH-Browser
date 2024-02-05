const { app, BrowserWindow, ipcMain } = require('electron')
const { dialog } = require('electron');

const fs = require('fs')
const os = require('os')
const path = require('node:path')
const { NodeSSH } = require('node-ssh')

let connection = null;

let sessionsPath = path.join(__dirname, 'sessions.json');
let mainWindow = null;

let _clog = console.log;
console.log = function(...args) { _clog(new Date().toLocaleDateString('nl-NL'), ...args); }

const downloadPath = app.getPath('downloads');

const OS = {
    isWindows: os.platform() === 'win32',
    isMac: os.platform() === 'darwin',
    isLinux: os.platform() === 'linux'
}

/**
 * Method for creating a window.
 * @returns {Electron.CrossProcessExports.BrowserWindow} The created window.
 */
function createWindow() {
    let window = new BrowserWindow({
        width: 900,
        height: 700,
        transparent: true,
        titleText: 'SSH Client',
        titleBarOverlay: false,
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js")
        }
    });

    // Show the window buttons on macOS
    if (OS.isMac)
        window.setWindowButtonVisibility(true);

    window.loadFile('./index.html')
        .catch((err) => console.error(err));
    return window;
}

app.whenReady().then(() => {
    mainWindow = createWindow()
    mainWindow.setMinimumSize(600, 500);
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
    if (!OS.isMac)
        app.quit()
})

/** Event handler for the 'select files' dialog menu **/
ipcMain.handle('open-files', async () => openFiles());

/** Event handler for downloading a file from the remote server **/
ipcMain.handle('download-file', async (_, remotePath, fileName) => downloadFile(remotePath, fileName));

/** Event handler for listing files on the remote server **/
ipcMain.handle('list-files', async (_, directory) => listFiles(directory));

/** Event handler for listing the current working directory on the remote server **/
ipcMain.handle('list-directory', async () => listDirectory());

/** Event handler for deleting files on the remote server **/
ipcMain.handle('delete-file', async (_, directory, fileName) => deleteFile(directory, fileName));

/** Event handler for retrieving the successful sessions in sessions.json **/
ipcMain.handle('retrieve-sessions', retrieveSessions);

/** Event handler for retrieving the status of the current SSH connection **/
ipcMain.handle('connection-status', sshConnected)

/** Event handler for attempting to connect to a remote server **/
ipcMain.handle('connect', async (_, ...args) => sshConnect(...args))

/** Event handler for uploading multiple files **/
ipcMain.handle('upload-files', async (_, directory, files) => uploadFiles(directory, files))

/** Event handler for renaming a file on the remote server. */
ipcMain.handle('rename-file', async (_, directory, file, newName) => renameFile(directory, file, newName))

/** Event handler for navigating to the home directory **/
ipcMain.handle('view-starting-directory', async _ => viewStartingDir());

/** Event handler for creating a directory on the remote server **/
ipcMain.handle('create-directory', async (_, directory, title) => createDirectory(directory, title));

ipcMain.handle('get-file-info', async (_, directory, file) => getFileInfo(directory, file));

/** Event handler for resizing the main window **/
ipcMain.on('window-resize', (_, width, height) => mainWindow.setSize(width, height))

/** Event handler for minimizing the main window **/
ipcMain.on('window-minimize', _ => mainWindow.minimize());

ipcMain.on('current-session', (event) => {
    event.returnValue = {username: connection.username, host: connection.host, port: connection.port};
})

ipcMain.handle('cmd', async (_, cwd, command) => {
    return new Promise(resolve => {
        if (sshConnected()) {
            connection.ssh.execCommand(command, { cwd: cwd })
                .then(res => resolve(res.stdout))
                .catch(e => resolve(e));
        } else resolve('Not connected');
    })
})

ipcMain.on('log', (_, args) => console.log(args));

/**
 * Method for creating a directory on the remote server.
 * @param {string} directory The directory in which to create the new directory.
 * @param {string} name The name of the new directory.
 * @returns {Promise<*>} Resolved promise when directory creation is successful; rejected promise when an error occurs.
 */
async function createDirectory(directory, name) {
    return new Promise((resolve, reject) => {
        if (sshConnected()) {
            connection.ssh.execCommand(`cd ${directory} && mkdir ${name}`)
                .then(result => resolve())
                .catch(err => reject(err));
        } else reject('Not connected');
    })
}

/**
 * Method for viewing the files in the starting directory.
 * @returns {Promise<string | Error>} A promise that resolves to a string containing the files in the
 * directory and the path to the directory. Rejects when there's no active connection or an error occurs.
 */
async function viewStartingDir() {
    return new Promise((resolve, reject) => {
        if (sshConnected()) {
            connection.ssh.execCommand('pwd && ls')
                .then(result => resolve({path: result.stdout.split('\n')[0], files: result.stdout.split('\n').slice(1)}))
                .catch(err => reject(err));
        } else reject('Not connected');
    })
}

/**
 * Method for renaming a file on the remote server.
 * @param {string} directory The directory in which the file is located.
 * @param {string} file The name of the file to rename.
 * @param {string} newName The new name of the file.
 * @returns {Promise<void | Error>} Resolved promise when file renaming is successful; rejected promise when an error occurs.
 */
async function renameFile(directory, file, newName) {
    return new Promise((resolve, reject) => {
        if (sshConnected()) {
            connection.ssh.execCommand(`cd ~ && cd ${directory} && mv ${file} ${newName}`)
                .then(_ => resolve())
                .catch(err => reject(err));
        } else reject('Not connected');
    })
}

/**
 * Method for downloading a file from the remote server.
 * @param {string} remotePath The remote path to the file
 * @param {string} fileName The name of the file to save the file as.
 * @returns {Promise<unknown>}
 */
async function downloadFile(remotePath, fileName) {
    return new Promise((resolve, reject) => {
        if (sshConnected()) {
            console.log('Downloading file: ' + remotePath + ' to ' + downloadPath)
            connection.ssh.getFile(downloadPath + '/' + fileName, remotePath + '/' + fileName, null, {
                step: (transferred, chunk, total) => {
                    console.log(100 * transferred / total);
                    mainWindow.webContents.send('file-download-progress', {progress: 100 * transferred / total, finished: transferred === total});
                }
            })
                .then(_ => resolve())
                .catch(err => reject(err));
        } else reject('Not connected');
    })
}

/**
 * Method for retrieving file info from the remote server.
 * @param {string} directory The directory in which the file is located.
 * @param {string} fileName The name of the file.
 * @returns {Promise<{permissions: string, owner: string, fileSize: number, lastModified: Date} | Error>}
 */
async function getFileInfo(directory, fileName) {
    return new Promise((resolve, reject) => {
        if (sshConnected()) {
            connection.ssh.execCommand(`cd ~ && cd ${directory} && ls -l -d '${fileName}'`)
                .then(result => {
                    let arguments = result.stdout.split(' ');
                    resolve({
                        permissions: arguments[0],
                        owner: arguments[2],
                        fileSize: parseInt(arguments[4]),
                        lastModified: arguments[6] + ' ' + arguments[5] + ', ' + arguments[7]
                    })
                })
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
        if (files.length === 0)
            return resolve('No files to upload');
        if (sshConnected()) {

            for (let i = 0; i < files.length; i++) {
                let path = files[i];
                // If file doesn't exist, reject
                if (!fs.existsSync(path)) {
                    return reject('File at ' + path + ' does not exist');
                }
                // Check whether provided file is a directory
                if (fs.lstatSync(path).isDirectory()) {
                    // Remove file from argument and call 'putDirectory' instead
                    files.splice(i, 1);
                    return connection.ssh.putDirectory(path, directory, {
                        recursive: true,
                        concurrency: 5,
                        transferOptions: {
                            step: (transfer_count, chunk, total) => {
                                mainWindow.webContents.send('file-transfer-progress',
                                    {progress: 100 * transfer_count / total, finished: transfer_count === total});
                            }
                        }
                    })
                        .then(_ => resolve(true))
                        .catch(e => reject(e))
                }
            }

            connection.ssh.putFiles(files.map(path => {
                return {local: path, remote: directory + '/' + path.split('/').pop()}
            }),  {
                concurrency: 5,
                transferOptions: {
                    step: (transfer_count, chunk, total) => {
                        mainWindow.webContents.send('file-transfer-progress',
                            {progress: 100 * transfer_count / total, finished: transfer_count === total});
                    }
                }
            })
                .then(_ => resolve(true))
                .catch(e => reject(e))
        } else resolve('Not connected');
    })
}

/**
 * Method for checking the status of the current SSH connection.
 * @returns {boolean} Whether or not the connection is active.
 */
function sshConnected() {
    return connection?.ssh.isConnected() || false;
}


/**
 * Method for connecting to a remote server, given the provided arguments.
 * @param {string} host The host to connect to.
 * @param {string} username The username to use for the connection.
 * @param {string} password The password to use for the connection.
 * @param {number} port The port to use for the connection (default: 22).
 * @param {string} privateKey The private key to use for the connection (default: null).
 * @param {string} passphrase The passphrase to use for the private key (default: null).
 * @returns {Promise<*>} A promise that resolves when the connection is successful; rejects when an error occurs.
 */
async function sshConnect(host, username, password, port = 22, privateKey = null, passphrase = null) {
    return new Promise((resolve, reject) => {
        if (sshConnected() && (connection.host === host && connection.username === username && connection.port === port))
            return resolve();

        connection = { ssh: new NodeSSH(), port: port, host: host, username: username, password: password, privateKey: privateKey, passphrase: passphrase }

        connection.ssh.connect({
            host: connection.host,
            privateKey: connection.privateKey,
            username: connection.username,
            password: connection.password,
            port: connection.port,
            passphrase: connection.passphrase,
            tryKeyboard: true,

            onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
                finish([connection.password]);
            }
        })
            .then(ssh => {
                storeSession(connection); // store the session in sessions.json
                ssh.withShell((err, stream) => {
                    if (err) return reject(err);
                    stream.on('data', data => {
                        mainWindow.webContents.send('ssh-output', data.toString());
                    }).stderr.on('data', data => {
                        mainWindow.webContents.send('ssh-output', data.toString());
                    })

                })
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
        if (sshConnected()) {
            dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
                .then(result => resolve(result.filePaths))
                .catch(err => reject(err));
        } else reject('Not connected');
    })
}

/**
 * Method to list the files in a directory.
 * @param {string} path The absolute path in which to list the files.
 * @returns {Promise<string>} A promise that resolves to a string containing the files in the directory.
 * Rejects when the path is not a string or when there's no active connection, or an error occurs.
 */
async function listFiles(path) {
    return new Promise((resolve, reject) => {

        // Check whether the provided argument is a string or not.
        // If this is not the case, do not proceed.
        if (! (typeof path === 'string' || path instanceof String))
            return reject('Argument \'directory\' is not a string');

        // Check whether there's an active connection.
        // If this is the case, we move to the provided directory and list its files
        if (sshConnected()) {
            return connection.ssh.execCommand(`cd ${path} && ls`)
                .then(result => resolve(result.stdout))
                .catch(err => {reject(err)});
        } else reject('Not connected');
    });
}

async function listDirectory() {
    return new Promise((resolve, reject) => {
        if (sshConnected()) {
            connection.ssh.execCommand('pwd')
                .then(result => resolve(result.stdout))
                .catch(err => {reject(err)});
        } else reject('Not connected')
    })
}

/**
 * Method for deleting a file from the remote server.
 * @param {string} directory The directory in which the file is located.
 * @param {string} file The name of the file to delete.
 * @returns {Promise<void | Error>} Resolved promise when file deletion is successful; rejected promise when an error occurs.
 */
async function deleteFile(directory, file) {
    return new Promise((resolve, reject) => {
        if (sshConnected()) {
            console.error("Attempting to remove file: " + file + " from directory: " + directory);

            // Remove file.
            return connection.ssh.execCommand(`cd ${directory} && rm -r '${file}'`)
                .then(_ => resolve())
                .catch(err => {reject(err)});
        } else reject('Not connected');
    });
}

/**
 * Method for retrieving the successful sessions in sessions.json.
 * @returns {Promise<Object | Error>} A promise that resolves to the content of the sessions file.
 */
async function retrieveSessions() {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(__dirname, 'sessions.json'), (err, data) => {
            if (err) return reject(err);

            let content = {};
            try { content = JSON.parse(data.toString()); } catch (e) {}

            resolve(content);
        });
    });
}

/**
 * Method for updating the sessions file with a new successful connection.
 * @param {{host: string, username: string, password: string, port: number, privateKey: string, passphrase: string}} session
 * The connection object to update the sessions file with.
 */
function storeSession(session) {

    // Get previous data
    fs.readFile(sessionsPath, (error, data) => {
        if (error)
            throw error;
        // Parse previous data
        let sessions = JSON.parse(data.toString());

        // Check if the connection is already in the sessions file, if not, add it.
        if (!sessions.some(session => session.host === session.host && session.username === session.username)) {

            // Add new data
            sessions.push({
                host: session.host,
                username: session.username,
                password: session.password,
                port: session.port,
                privateKey: session.privateKey,
                passphrase: session.passphrase
            });

            // Write back to file
            fs.writeFile(sessionsPath, JSON.stringify(sessions), (err) => {
                if (err) throw err;
            })
        }
    })
}
