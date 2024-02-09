const { app, BrowserWindow, ipcMain } = require('electron')
const { dialog } = require('electron');

const fs = require('fs')
const os = require('os')
const path = require('node:path')
const { NodeSSH } = require('node-ssh')

/** List of open connections
 * @type {{ssh: NodeSSH, host: string, username: string, password: string, port: number, privateKey: string, passphrase: string}[]}*/
let connections = [];
let currentConnection = 0;

let sessionsPath = path.join(__dirname, 'sessions.json');
let mainWindow = null;

let log = console.log;

let _clog = console.log;
console.log = function(...args) { _clog(`${new Date().toLocaleDateString('en-UK')} |`, ...args); }

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
        icon: './assets/app_icon.png',
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js")
        }
    });

    // Show the window buttons on macOS
    if (OS.isMac) window.setWindowButtonVisibility(true);

    window.loadFile('./index.html')
        .catch((err) => console.error(err));
    return window;
}

app.whenReady().then(() => {
    mainWindow = createWindow()
    mainWindow.setMinimumSize(600, 500);
    app.on('activate',  _ => {
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
    if (!sshConnected()) return event.returnValue = null;
    event.returnValue = {username: sshCurrent().username, host: sshCurrent().host, port: sshCurrent().port};
})

ipcMain.handle('delete-session', (_, host, username) => deleteSession(host, username));

ipcMain.on('log', (_, args) => console.log(args));

/**
 * Method for creating a directory on the remote server.
 * @param {string} directory The directory in which to create the new directory.
 * @param {string} name The name of the new directory.
 * @returns {Promise<*>} Resolved promise when directory creation is successful; rejected promise when an error occurs.
 */
async function createDirectory(directory, name) {
    [directory] = fmtPaths(directory);
    console.log(`Attempting to create dir at [${directory}] with name [${name}]`)
    return new Promise((resolve, reject) => {
        if (sshConnected()) {
            ssh().execCommand(`cd ${directory} && mkdir '${name}'`)
                .then(_ => {
                    console.log("Directory successfully created");
                    resolve()
                })
                .catch(err => {
                    console.log("An error occurred whilst attempting to create directory:", err);
                    reject(err)
                });
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
            ssh().execCommand('pwd && ls')
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
    [directory, file, newName] = fmtPaths(directory, file, newName);
    return new Promise((resolve, reject) => {
        if (sshConnected()) {
            ssh().execCommand(`cd ${directory} && mv ${file} ${newName}`)
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
    [remotePath, fileName] = fmtPaths(remotePath, fileName);
    return new Promise((resolve, reject) => {
        if (sshConnected()) {
            console.log('Downloading file: ' + remotePath + '/' + fileName + ' to ' + downloadPath)
            ssh().getFile(downloadPath + '/' + fileName, remotePath + '/' + fileName, null, {
                step: (transfer_count, chunk, total) => {
                    mainWindow.webContents.send('process-status',
                        {type: 'download', progress: 100 * transfer_count / total, finished: transfer_count === total});
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
    [directory, fileName] = fmtPaths(directory, fileName)

    return new Promise((resolve, reject) => {
        if (sshConnected()) {
            ssh().execCommand(`cd ${directory} && ls -l -d ${fileName}`)
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
    [directory] = fmtPaths(directory);
    return new Promise((resolve, reject) => {
        if (files.length === 0)
            return resolve('No files to upload');
        if (sshConnected()) {

            let opt = {
                step: (transfer_count, chunk, total) => {
                    mainWindow.webContents.send('process-status',
                    {type: 'upload', progress: 100 * transfer_count / total, finished: transfer_count === total});
                }
            }

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
                    /**
                     * TODO - Compress directory and upload as a single file
                     */
                    ssh().putDirectory(path, directory, {
                        recursive: true,
                        concurrency: 5,
                        transferOptions: opt
                    })
                        .then(_ => resolve(true))
                        .catch(e => reject(e))
                }
            }

            ssh().putFiles(files.map(path => {
                return {local: path, remote: directory + '/' + path.split('/').pop()}
            }),  {
                concurrency: 5,
                transferOptions: opt
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
    return ssh()?.isConnected() || false;
}

function sshCurrent() {
    return connections[currentConnection];
}

function ssh() { return sshCurrent()?.ssh; }

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
        let cur = sshCurrent();

        port = port || 22;

        // If the connection is already active and one is
        // trying to connect with the same credentials, resolve the promise.
        if ((cur?.ssh.isConnected()) && cur.host === host && cur.username === username && cur.port === port) {
            currentConnection = connections.indexOf(cur);
            log && log('Connection already active');
            return resolve();
        }

        log && log('Attempting to connect to ' + host + ' with username ' + username + ' on port ' + port);

        let connection = { ssh: new NodeSSH(), port: port, host: host, username: username, password: password, privateKey: privateKey, passphrase: passphrase }

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

                log && log('Connected to ' + host + ' with username ' + username + ' on port ' + port);

                connections.push(connection);
                currentConnection = connections.length - 1;

                ssh.requestShell({term: process.env.TERM || 'vt100'})
                    .then((stream) => {
                        stream.on('data', data => {
                            mainWindow.webContents.send('message-received', data.toString());
                        }).stderr.on('data', data => {
                            mainWindow.webContents.send('message-received', data.toString());
                        });
                        ipcMain.removeHandler('cmd');
                        ipcMain.handle('cmd', async (_, command) => {
                            stream.pause();
                            stream.write(command + '\n');
                            stream.resume();
                        })
                    })
                    .catch(e => console.log("An error occurred whilst requesting shell", e))
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
    [path] = fmtPaths(path);
    return new Promise((resolve, reject) => {

        // Check whether the provided argument is a string or not.
        // If this is not the case, do not proceed.
        if (! (typeof path === 'string' || path instanceof String))
            return reject('Argument \'directory\' is not a string');

        // Check whether there's an active connection.
        // If this is the case, we move to the provided directory and list its files
        if (sshConnected()) {
            return ssh().execCommand(`cd ${path} && ls`)
                .then(result => resolve(result.stdout))
                .catch(err => {reject(err)});
        } else reject('Not connected');
    });
}

/**
 * Method for deleting a file from the remote server.
 * @param {string} directory The directory in which the file is located.
 * @param {string} file The name of the file to delete.
 * @returns {Promise<void | Error>} Resolved promise when file deletion is successful; rejected promise when an error occurs.
 */
async function deleteFile(directory, file) {
    [directory] = fmtPaths(directory);
    return new Promise((resolve, reject) => {
        if (sshConnected()) {
            console.error("Attempting to remove file: " + file + " from directory: " + directory);

            // Remove file.
            return ssh().execCommand(`cd ${directory} && rm -r '${file}'`)
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
        if (error) {
            console.error(error);
            throw error;
        }
        // Parse previous data
        let sessions = JSON.parse(data.toString());

        // Check if the connection is already in the sessions file, if not, add it.
        if (!sessions.some(ses => ses.host === session.host && ses.username === session.username && ses.port === session.port)) {
            // Add new data
            sessions.push({
                host: session.host,
                username: session.username,
                password: session.password,
                port: session.port,
                privateKey: session.privateKey,
                passphrase: session.passphrase
            });

            // 192.168.238.76 
            //  blackbananaman
            // TODO: Encrypt the data before writing it to the file.

            // Write back to file
            fs.writeFile(sessionsPath, JSON.stringify(sessions), (err) => {
                if (err) {
                    console.error("An error occurred whilst attempting to write file:", err);
                    throw err;
                }
            })
        }
    })
}

/**
 * Method for deleting a session from the sessions file.
 * @param {string} host The host of the session to delete.
 * @param {string} username The username of the session to delete.
 */
function deleteSession(host, username) {
    fs.readFile(sessionsPath, (error, data) => {
        if (error)
            throw error;
        let sessions = JSON.parse(data.toString());
        let index = sessions.findIndex(session => session.host === host && session.username === username);
        if (index !== -1) {
            sessions.splice(index, 1);
            fs.writeFile(sessionsPath, JSON.stringify(sessions), (err) => {
                if (err) throw err;
            })
        }
    })
}

function fmtPaths(...path) {
    return path.map(p => p.replaceAll(' ', '\\ '));
}