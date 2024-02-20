const {app, BrowserWindow, ipcMain, dialog} = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('node:path')
const { NodeSSH } = require('node-ssh')
const ansiHtml = require('ansi-to-html')
const { exec} = require('child_process')

const FileNames = { KEYBINDS: 'keybinds.json', SESSIONS: 'sessions.json', LANGUAGES: 'languages.json' }

const RESOURCES_PATH = path.join(app.getPath('appData'), app.getName());

const filter = new ansiHtml({newline: false, escapeXML: false, stream: false})

/** List of open connections
 * @type {{ssh: NodeSSH, host: string, username: string, password: string, port: number, privateKey: string, passphrase: string}[]}*/
let connections = [];
let currentConnection = 0;

let mainWindow = null;

let _clog = console.log;
console.log = (...args) => _clog(`${new Date().toLocaleDateString('en-UK')} |`, ...args);

function log(...args) {
    let timeStamp = new Date();
    console.log(timeStamp.toLocaleDateString('en-UK') + " " + timeStamp.toLocaleTimeString('en-UK'),...args);
}

const OS = {
    isWindows: os.platform() === 'win32',
    isMac: os.platform() === 'darwin',
    isLinux: os.platform() === 'linux'
}

/**
 * Method for creating a window.
 * @returns {Electron.CrossProcessExports.BrowserWindow} The created window.
 */
function createWindow()
{
    let window = new BrowserWindow({
        width: 900,
        height: 700,
        transparent: true,
        titleText: 'SSH Client',
        titleBarOverlay: false,
        icon: './resources/app_icon.png',
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js")
        }
    });

    // Show the window buttons on macOS
    if (OS.isMac) window.setWindowButtonVisibility(true);

    window.loadFile(path.join(__dirname, 'index.html'))
        .catch((err) => console.error(err));
    return window;
}

/**
 * When the app has successfully initialized, we can load some other things.
 * Example, creating the necessary files in the file system, if not present.
 */
app.whenReady().then(() =>
{
    mainWindow = createWindow()
    mainWindow.setMinimumSize(600, 500);
    app.on('activate', _ =>
    {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow()
    })

    // Create directory for storing SSH client data
    if (!fs.existsSync(RESOURCES_PATH))
        fs.mkdirSync(RESOURCES_PATH)
    console.log(RESOURCES_PATH)

    if (!fs.existsSync(path.join(RESOURCES_PATH, FileNames.KEYBINDS)))
    {
        let defaultContent = fs.readFileSync(path.join(__dirname, 'resources', 'static', FileNames.KEYBINDS));
        fs.writeFileSync(path.join(RESOURCES_PATH, FileNames.KEYBINDS), defaultContent)
        log("Created keybinds file")
    }

    if (!fs.existsSync(path.join(RESOURCES_PATH, FileNames.LANGUAGES)))
    {
        let defaultContent = fs.readFileSync(path.join(__dirname, 'resources', 'static', FileNames.LANGUAGES));
        fs.writeFileSync(path.join(RESOURCES_PATH, FileNames.LANGUAGES), defaultContent)
        log("Created languages file")
    }

    if (!fs.existsSync(path.join(RESOURCES_PATH, FileNames.SESSIONS)))
        fs.writeFileSync(path.join(RESOURCES_PATH, FileNames.SESSIONS), JSON.stringify([]))
})

app.on('window-all-closed', () =>
{
    if (!OS.isMac)
        app.quit()
})

/** Event handler for the 'select files' dialog menu **/
ipcMain.handle('open-files', async () => {
    return new Promise((resolve, reject) =>
    {
        if (sshConnected())
        {
            dialog.showOpenDialog({properties: ['openFile', 'multiSelections']})
                .then(result => resolve(result.filePaths))
                .catch(err => reject(err));
        } else reject('Not connected');
    })
});

/** Event handler for downloading a file from the remote server **/
ipcMain.handle('download-file', async (_, remotePath, fileName) => {
    return new Promise((resolve, reject) =>
    {
        if (sshConnected())
        {
            let localAbsolutePath = path.join(app.getPath('downloads'), fileName);
            let remoteAbsolutePath = path.join(remotePath, fileName);
            ssh().getFile(localAbsolutePath, remoteAbsolutePath, null, {
                step: (transfer_count, chunk, total) =>
                {
                    mainWindow.webContents.send('process-status',
                        {type: 'download', progress: 100 * transfer_count / total, finished: transfer_count === total});
                }
            })
                .then(_ => resolve())
                .catch(err => reject(err));
        } else reject('Not connected');
    })
});

/** Event handler for listing files on the remote server **/
ipcMain.handle('list-files', async (_, path) => {
    [path] = fmtPaths(path);
    return new Promise((resolve, reject) =>
    {

        // Check whether the provided argument is a string or not.
        // If this is not the case, do not proceed.
        if (!(typeof path === 'string' || path instanceof String))
            return reject('Argument \'directory\' is not a string');

        // Check whether there's an active connection.
        // If this is the case, we move to the provided directory and list its files
        if (sshConnected())
        {
            return ssh().execCommand(`cd ${path} && ls`)
                .then(result => resolve(result.stdout))
                .catch(err =>
                {
                    reject(err)
                });
        } else reject('Not connected');
    });
});

/** Event handler for deleting files on the remote server **/
ipcMain.handle('delete-file', async (_, directory, fileName) => {
    {
        [directory] = fmtPaths(directory);
        return new Promise((resolve, reject) =>
        {
            if (sshConnected())
            {
                console.error("Attempting to remove file: " + fileName + " from directory: " + directory);

                // Remove file.
                return ssh().execCommand(`cd ${directory} && rm -r '${fileName}'`)
                    .then(_ => resolve())
                    .catch(err =>
                    {
                        reject(err)
                    });
            } else reject('Not connected');
        });
    }
});

/** Event handler for retrieving the successful sessions in sessions.json **/
ipcMain.handle('retrieve-sessions', retrieveSessions);

/** Event handler for retrieving the status of the current SSH connection **/
ipcMain.handle('connection-status', sshConnected)

/** Event handler for attempting to connect to a remote server **/
ipcMain.handle('connect', async (_, host, username, password, port = 22, privateKey = null, passphrase = null) => {
    return new Promise((resolve, reject) =>
    {
        let cur = sshCurrent();

        port = port || 22;

        // If the connection is already active and one is
        // trying to connect with the same credentials, resolve the promise.
        if ((cur?.ssh.isConnected()) && cur.host === host && cur.username === username && cur.port === port)
        {
            currentConnection = connections.indexOf(cur);
            log('Connection already active');
            return resolve();
        }

        log('Attempting to connect to ' + host + ' with username ' + username + ' on port ' + port);

        let connection = {
            ssh: new NodeSSH(),
            port: port,
            host: host,
            username: username,
            password: password,
            privateKey: privateKey,
            passphrase: passphrase
        }

        connection.ssh.connect({
            host: connection.host,
            privateKey: connection.privateKey,
            username: connection.username,
            password: connection.password,
            port: connection.port,
            passphrase: connection.passphrase,
            tryKeyboard: true,

            onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) =>
                finish([connection.password])
        })
            .then(ssh =>
            {
                storeSession(connection); // store the session in sessions.json

                log('Connected to ' + host + ' with username ' + username + ' on port ' + port);

                connections.push(connection);
                currentConnection = connections.length - 1;

                ssh.requestShell({term: process.env.TERM || 'xterm-256color'})
                    .then((stream) =>
                    {
                        stream.setWindow(80, 24, 480, 600);
                        stream.on('data', data =>
                        {
                            mainWindow.webContents.send('message-received', filter.toHtml(data.toString()));
                        }).stderr.on('data', data =>
                        {
                            mainWindow.webContents.send('message-received', filter.toHtml(data.toString()));
                        });
                        ipcMain.removeHandler('cmd');
                        ipcMain.handle('cmd', async (_, command) =>
                        {
                            stream.pause();
                            stream.write(command + '\n');
                            stream.resume();
                        })
                    })
                    .catch(e => log("An error occurred whilst requesting shell", e))
                resolve();

            })
            .catch(err => reject(err));
    })
})

ipcMain.on('get-languages', (event) => event.returnValue = languages);

ipcMain.on('get-keybinds', (event) => event.returnValue = keybinds);

/**
 *  Event handler for uploading multiple files
 *  @param {string} directory The directory to upload the files to.
 *  @param {string[]} files The files to upload.
 **/
ipcMain.handle('upload-files', async (_, directory, /** @type {string[]}*/ files) =>
{
    // Format the path so that it's compatible with the remote server
    [directory] = fmtPaths(directory);

    return new Promise((resolve, reject) =>
    {
        // If there are no files to upload, resolve the promise with a message
        if (files.length === 0)
            return resolve();

        if (sshConnected())
        {
            let opt = {
                step: (transfer_count, chunk, total) =>
                {
                    mainWindow.webContents.send('process-status',
                        {type: 'upload', progress: 100 * transfer_count / total, finished: transfer_count === total});
                }
            }

            // Go through all provided file arguments and check whether they are directories.
            // If this is the case, remove them from the list and call 'putDirectory' instead.
            for (let i = 0; i < files.length; i++)
            {
                /** @type string */
                let filePath = files[i];

                // Check if the file exists. If not, remove it from the transfer list
                // and continue.
                if (!fs.existsSync(filePath))
                {
                    files.splice(i--, 1)
                    continue
                }

                // Check whether provided file is a directory
                if (fs.lstatSync(filePath).isDirectory())
                {
                    // Remove file from argument and call 'putDirectory' instead
                    files.splice(i, 1);
                    ssh().putDirectory(filePath, path.join(directory, filePath.split('/').pop()), {
                        recursive: true,
                        concurrency: 10,
                        transferOptions: opt
                    })
                        .then(_ => resolve())
                        .catch(e => reject(e))
                }
            }

            // If there are no files to upload, resolve the promise.
            if (files.length === 0)
                return resolve()

            // If there are still files to upload, call 'putFiles' to upload them.
            ssh().putFiles(files.map(_path =>
            {
                return {local: _path, remote: path.join(directory, _path.split('/').pop())}
            }), {
                concurrency: 10,
                transferOptions: opt
            })
                .then(_ => resolve())
                .catch(e => reject(e))
        } else resolve('Not connected');
    })
})

ipcMain.handle('move-file', async (_, fileName, srcPath, dstPath) => {
    [fileName, srcPath, dstPath] = fmtPaths(fileName, srcPath, dstPath);
    return new Promise((resolve, reject) =>
    {
        if (sshConnected())
        {
            ssh().execCommand(`mv ${path.join(srcPath, fileName)} ${path.join(dstPath, fileName)}`)
                .then(_ => resolve())
                .catch(err => reject(err));
        } else reject('Not connected');
    })
})

ipcMain.handle('rename-file', async (_, directory, fileName, newName) => {
    [directory, fileName, newName] = fmtPaths(directory, fileName, newName);
    return new Promise((resolve, reject) =>
    {
        if (sshConnected())
        {
            ssh().execCommand(`cd ${directory} && mv ${fileName} ${newName}`)
                .then(_ => resolve())
                .catch(err => reject(err));
        } else reject('Not connected');
    })
})

/** Event handler for navigating to the home directory **/
ipcMain.handle('starting-directory', async _ => {
    return new Promise((resolve, reject) =>
    {
        if (sshConnected())
        {
            ssh().execCommand('pwd && ls')
                .then(result => resolve({
                    path: result.stdout.split('\n')[0],
                    files: result.stdout.split('\n').slice(1)
                }))
                .catch(err => reject(err));
        } else reject('Not connected');
    })
});

/** Event handler for creating a directory on the remote server **/
ipcMain.handle('create-directory', async (_, directory, dirName) => {
    [directory] = fmtPaths(directory);
    log(`Attempting to create dir at [${directory}] with name [${dirName}]`)
    return new Promise((resolve, reject) =>
    {
        if (sshConnected())
        {
            ssh().execCommand(`cd ${directory} && mkdir '${dirName}'`)
                .then(_ =>
                {
                    log("Directory successfully created");
                    resolve()
                })
                .catch(err =>
                {
                    console.log("An error occurred whilst attempting to create directory:", err);
                    reject(err)
                });
        } else reject('Not connected');
    })
});

ipcMain.handle('get-file-info', async (_, directory, fileName) => {
    [directory, fileName] = fmtPaths(directory, fileName)

    return new Promise((resolve, reject) =>
    {
        if (sshConnected())
        {
            ssh().execCommand(`cd ${directory} && ls -l -d ${fileName}`)
                .then(result =>
                {
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
});

ipcMain.on('current-session', (event) =>
{
    if (!sshConnected()) return event.returnValue = null;
    event.returnValue = {username: sshCurrent().username, host: sshCurrent().host, port: sshCurrent().port};
})

ipcMain.handle('delete-session', (_, host, username) => deleteSession(host, username));

ipcMain.on('log', (_, args) => log(args));

ipcMain.on('get-config', (event, fileName) => {
    if (!FileNames[fileName.toUpperCase()])
        throw new Error('Config file does not exist.');

    event.returnValue = JSON.parse(fs.readFileSync(path.join(RESOURCES_PATH, FileNames[fileName.toUpperCase()])).toString());
});

/**
 * Method for checking the status of the current SSH connection.
 * @returns {boolean} Whether or not the connection is active.
 */
function sshConnected()
{
    return ssh()?.isConnected() || false;
}

function sshCurrent()
{
    return connections[currentConnection];
}

function ssh()
{
    return sshCurrent()?.ssh;
}

/**
 * Method for retrieving the successful sessions in sessions.json.
 * @returns {Promise<Object | Error>} A promise that resolves to the content of the sessions file.
 */
async function retrieveSessions()
{
    return new Promise((resolve, reject) =>
    {
        fs.readFile(path.join(__dirname, 'sessions.json'), (err, data) =>
        {
            if (err) return reject(err);

            let content = {};
            try
            {
                content = JSON.parse(data.toString());
            } catch (e)
            {
            }

            resolve(content);
        });
    });
}

/**
 * Method for updating the sessions file with a new successful connection.
 * @param {{host: string, username: string, password: string, port: number, privateKey: string, passphrase: string}} session
 * The connection object to update the sessions file with.
 */
function storeSession(session)
{

    // Get previous data
    fs.readFile(path.join(RESOURCES_PATH, FileNames.SESSIONS), (error, data) =>
    {
        if (error)
        {
            console.error(error);
            throw error;
        }
        // Parse previous data
        let sessions = JSON.parse(data.toString());

        // Check if the connection is already in the sessions file, if not, add it.
        if (!sessions.some(ses => ses.host === session.host && ses.username === session.username && ses.port === session.port))
        {
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
            fs.writeFile(path.join(RESOURCES_PATH, FileNames.SESSIONS), JSON.stringify(sessions), (err) =>
            {
                if (err)
                {
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
function deleteSession(host, username)
{
    fs.readFile(path.join(RESOURCES_PATH, FileNames.SESSIONS), (error, data) =>
    {
        if (error)
            throw error;

        let sessions = JSON.parse(data.toString());
        let index = sessions.findIndex(session => session.host === host && session.username === username);
        if (index !== -1)
        {
            sessions.splice(index, 1);
            fs.writeFile(path.join(RESOURCES_PATH, FileNames.SESSIONS), JSON.stringify(sessions), (err) =>
            {
                if (err) throw err;
            })
        }
    })
}

function fmtPaths(...paths)
{
    return paths.map(p => p.replaceAll(' ', '\\ '));
}