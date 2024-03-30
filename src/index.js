/**
 * The main file for the SSH client.
 *
 * @Author Luca Warmenhoven
 * @Date 14 / 02 / 2024
 */

const { app, BrowserWindow, ipcMain, dialog, Menu, TouchBar, systemPreferences } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('node:path')
const { NodeSSH } = require('node-ssh')
const ansiHtml = require('ansi-to-html')
const { platform } = require("os");

const FileNames = {
    KEYBINDS: 'keybinds.json',
    SESSIONS: 'sessions.json',
    LANGUAGES: 'languages.json',
    FILE_ICONS: 'file_icons.json'
}

const StaticFiles = [ 'FILE_ICONS' ]

const RESOURCES_PATH = path.join(app.getPath('appData'), app.getName());

let ansiConverter;

// Whether to reload the static content into the appdata directory
// This is useful for testing and development purposes
const LOAD_STATIC_CONTENT = false;

/** List of open connections
 * @type {{ssh: NodeSSH, host: string, username: string, password: string, port: number, privateKey: string, passphrase: string}[]}*/
let connections = [];
let currentConnection = 0;

// Window variables
let mainWindow = null;
let /* TEMPORARY */ terminalWindow = null;
let fileEditorWindows = [];

function log(message, ...args)
{
    let timeStamp = new Date();
    console.log(
        `${timeStamp.toLocaleDateString('en-UK')} ${timeStamp.toLocaleTimeString('en-UK')} | ${message}`,
        ...args);
}

// Which operating system is the app running on.
const OS = {
    isWindows: os.platform() === 'win32',
    isMac: os.platform() === 'darwin',
    isLinux: os.platform() === 'linux'
}

/**
 * Method for creating a window.
 * @param {string | null} pagePath The path to the page to load in the window.
 * @param {Electron.BrowserWindowConstructorOptions} createArgs The arguments to create the window with.
 * @returns {Electron.CrossProcessExports.BrowserWindow} The created window.
 */
function createWindow(pagePath = null, createArgs = {})
{
    pagePath ||= path.join(__dirname, 'index.html');
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
            preload: path.join(__dirname, "core", "preload.js")
        },
        ...createArgs
    });

    // Show the window buttons on macOS
    if ( OS.isMac )
        window.setWindowButtonVisibility(true);

    window.loadFile(pagePath).catch(console.error);

    return window;
}

/**
 * When the app has successfully initialized, we can load some other things.
 * Example, creating the necessary files in the file system, if not present.
 */
app.whenReady().then(() =>
{
    mainWindow = createWindow();
    mainWindow.setMinimumSize(600, 500);

    app.on('activate', _ =>
    {
        if ( BrowserWindow.getAllWindows().length === 0 )
            createWindow();
    })

    // Create directory for storing SSH client data
    if ( !fs.existsSync(RESOURCES_PATH) )
        fs.mkdirSync(RESOURCES_PATH)

    if ( !fs.existsSync(path.join(RESOURCES_PATH, FileNames.KEYBINDS)) || LOAD_STATIC_CONTENT )
    {
        let defaultContent = fs.readFileSync(path.join(__dirname, 'resources', 'static', FileNames.KEYBINDS));
        fs.writeFileSync(path.join(RESOURCES_PATH, FileNames.KEYBINDS), defaultContent)
        log("Created keybinds file")
    }

    if ( !fs.existsSync(path.join(RESOURCES_PATH, FileNames.LANGUAGES)) || LOAD_STATIC_CONTENT )
    {
        let defaultContent = fs.readFileSync(path.join(__dirname, 'resources', 'static', FileNames.LANGUAGES));
        fs.writeFileSync(path.join(RESOURCES_PATH, FileNames.LANGUAGES), defaultContent)
        log("Created languages file")
    }

    if ( !fs.existsSync(path.join(RESOURCES_PATH, FileNames.SESSIONS)) )
        fs.writeFileSync(path.join(RESOURCES_PATH, FileNames.SESSIONS), JSON.stringify([]));
})

/**
 * Function that loads a file from the file system.
 * Once the file has successfully been read, it calls the callback function
 * provided as function parameter.
 * If an error occurs, it calls the errorCallback function with the error as parameter.
 * @param {string} path The path to read the file data from
 */
function loadFile(path)
{
    return new Promise((resolve, reject) =>
    {

        if ( !fs.existsSync(path) )
            return reject("File does not exist.");

        fs.readFile(path, 'utf-8', (err, data) =>
        {
            if ( err )
                return reject(err);
            resolve(data);
        });
    });
}

// Quits the application if all windows are closed (windows & linux)
app.on('window-all-closed', () => OS.isMac || app.quit())

/**
 * Handler for opening an external terminal window, with a provided directory.
 * This handler then connects a shell to that window every time the window is opened.
 */
ipcMain.on('open-terminal', async (_, directory) =>
{
    if ( terminalWindow && !terminalWindow.isDestroyed() )
    {
        terminalWindow.focus();
        return;
    }

    // Create terminal window
    terminalWindow = createWindow(path.join(__dirname, 'pages/page-external-terminal.html'), {
        width: 600,
        height: 480
    });

    terminalWindow.messageQueue = terminalWindow.messageQueue || [];
    terminalWindow.canReceiveMessages = false;
    terminalWindow.dispatchMessages = _ =>
    {
        terminalWindow.messageQueue
            .forEach(message => terminalWindow.webContents.send('message-received', message));
        terminalWindow.messageQueue = [];
    }

    // Send all messages that have been received before the window was ready
    terminalWindow.on('ready-to-show', _ =>
    {
        terminalWindow.dispatchMessages();
        terminalWindow.canReceiveMessages = true;
    });

    // Create a new shell connection
    ssh()
        .requestShell({ term: process.env.TERM || 'xterm-256color' })
        .then((stream) =>
        {
            // Ensure the filter has been created
            ansiConverter ||= new ansiHtml({ newline: true, escapeXML: false, stream: false });

            stream.write('cd ' + directory + '\n');
            stream.setWindow(80, 24, 480, 600);

            // Add event handlers for every stream type
            [ stream.stderr, stream.stdout ].forEach(stream =>
                stream.on('data', data =>
                    {
                        // Check if we can receive messages
                        if ( terminalWindow.isDestroyed() )
                        {
                            stream.end();
                            return;
                        }

                        // If the terminal window is not ready to receive messages, add them to the message queue
                        if ( !terminalWindow.canReceiveMessages )
                            terminalWindow.messageQueue.push(ansiConverter.toHtml(data.toString()));
                        else
                        {
                            if ( terminalWindow.messageQueue.length > 0 )
                                terminalWindow.dispatchMessages();

                            terminalWindow.webContents.send('message-received', ansiConverter.toHtml(data.toString()))
                        }
                    }
                ));

            ipcMain.removeHandler('cmd');
            ipcMain.handle('cmd', async (_, command) =>
            {
                stream
                    .pause()
                    .write(command + '\n', 'utf-8', _ => stream.resume());
            })

            terminalWindow.on('close', _ => stream.end());
        })
        .catch(e => log("An error occurred whilst requesting shell", e));
});

ipcMain.on('open-file-editor-remote', async (_, remoteDirectory, fileName) =>
{
    // If there's no active ssh connection, abort
    if ( !isSSHConnected() )
        return;

    // Temp folder to store the file in
    let localDirectory = app.getPath('temp');
    let localAbsoluteFilePath = path.join(localDirectory, fileName);

    let onWindowClose = _ =>
    {
        // Delete cache files
        fs.unlink(localAbsoluteFilePath, err =>
        {
            if ( err )
                log('An error occurred whilst attempting to delete file:', err);
            else log("Deleted window from cache");
        });
    }

    // Download file from remote server
    await ssh().getFile(localAbsoluteFilePath, remoteDirectory + '/' + fileName)
        .then(_ =>
        {
            // Read file content from local file system
            let content = fs.readFileSync(localAbsoluteFilePath).toString();
            let context = {
                originPath: localDirectory,
                targetPath: remoteDirectory,
                fileName: fileName,
                origin: 'remote',
                content: content
            };

            __openFileEditor(context, onWindowClose);

        })
        .catch(e =>
        {
            log('An error occurred whilst attempting to download file:', e)
        });
})

/**
 * Event handler for opening a new file editor window.
 */
ipcMain.on('open-file-editor', (_, context) => __openFileEditor(context));

/**
 *
 * @param {{originPath: string, targetPath: string | null, fileName: string, origin: 'local' | 'remote', content: string | null}} context
 * @param {function} [windowCloseCallback = null] Callback for when the window closes
 * @param {function} [webPageLoadCallback = null] Callback for when the webpage has loaded
 * @returns {Electron.CrossProcessExports.BrowserWindow}
 * @private
 */
function __openFileEditor(context, windowCloseCallback = undefined, webPageLoadCallback = undefined)
{

    // Assure that the context has the required object properties.
    if ( context && (context.origin === 'local' || !context.origin) )
    {
        context.origin = 'local';
        context.targetPath ||= context.originPath;
        context.content ||= fs.readFileSync(path.join(context.originPath, context.fileName)).toString();
    }

    let targetWindow;

    // If there exists another window with the same origin,
    // Open the files in that window.
    if ( fileEditorWindows.some(w => w.origin === context.origin) )
    {
        targetWindow = fileEditorWindows.find(w => w.origin === context.origin).window;
        targetWindow.webContents.send('file-editor-acquire-context', context);
        targetWindow.focus();
    }
    else
    {
        // Create a new window
        targetWindow = createWindow(path.join(__dirname, 'pages/page-external-file-editor.html'), {
            width: 1000,
            height: 700
        });
        fileEditorWindows.push({
            window: targetWindow,
            origin: context.origin
        });
        // Once the window has successfully opened
        // temp folder and load its contents onto the file editor.
        targetWindow.webContents.on('did-finish-load', async _ =>
        {
            if ( context )
                targetWindow.webContents.send('file-editor-acquire-context', context);
            webPageLoadCallback && webPageLoadCallback();
        });

        targetWindow.on('close', _ =>
        {
            // Remove from the list of file editor windows
            fileEditorWindows.splice(fileEditorWindows.findIndex((entry) => entry.window === targetWindow), 1);
            windowCloseCallback && windowCloseCallback();
        });
    }

    return targetWindow;
}

/**
 * Event handler for saving a file to the local file system
 */
ipcMain.handle('save-local-file', async (_, absolutePath, content) =>
{
    return new Promise((resolve, reject) =>
    {
        fs.writeFile(absolutePath, content, err =>
        {
            if ( err )
            {
                log('An error occurred whilst attempting to save file:', err);
                reject(err);
            }
            else resolve();
        })
    });
})

/**
 * Event handler for renaming a file on the local file system.
 */
ipcMain.handle('rename-local-file', async (_, localPath, oldFileName, newFileName) =>
{
    return new Promise((resolve, reject) =>
    {
        fs.rename(path.join(localPath, oldFileName), path.join(localPath, newFileName), err =>
        {
            if ( err )
            {
                log('An error occurred whilst attempting to rename file:', err);
                reject(err);
            }
            else resolve();
        })
    });
})

/**
 * Event handler for the 'select files' dialog menu
 **/
ipcMain.handle('open-files', async () =>
{
    return new Promise((resolve, reject) =>
    {
        if ( isSSHConnected() )
        {
            dialog.showOpenDialog({ properties: [ 'openFile', 'multiSelections' ] })
                .then(result => resolve(result.filePaths))
                .catch(err => reject(err));
        }
        else reject('Not connected');
    })
});

/**
 * Event handler for downloading a file from the remote server
 * This handler attempts to retrieve a file from the absolute remote path and save
 * it to the local downloads' directory.
 **/
ipcMain.handle('download-file', async (_, remotePath, fileName) =>
{
    return new Promise((resolve, reject) =>
    {
        if ( isSSHConnected() )
        {
            let localAbsolutePath = path.join(app.getPath('downloads'), fileName);
            let remoteAbsolutePath = path.join(remotePath, fileName);
            ssh().getFile(localAbsolutePath, remoteAbsolutePath, null, {
                step: (transfer_count, chunk, total) =>
                {
                    mainWindow.webContents.send('process-status',
                        {
                            type: 'download',
                            progress: 100 * transfer_count / total,
                            finished: transfer_count === total
                        });
                }
            })
                .then(_ => resolve())
                .catch(err => reject(err));
        }
        else reject('Not connected');
    })
});

/**
 * Event handler for listing files on the remote server.
 * This handler attempts to list the available files on the remote server
 * in the provided directory.
 * The promise is then resolved with the list of files, separated by '\n'.
 **/
ipcMain.handle('list-files', async (_, path) =>
{
    [ path ] = fmtPaths(path);
    return new Promise((resolve, reject) =>
    {

        // Check whether the provided argument is a string or not.
        // If this is not the case, do not proceed.
        if ( !(typeof path === 'string' || path instanceof String) )
            return reject('Argument \'directory\' is not a string');

        // Check whether there's an active connection.
        // If this is the case, we move to the provided directory and list its files
        if ( isSSHConnected() )
        {
            return ssh().execCommand(`cd ${path} && ls`)
                .then(result => resolve(result.stdout))
                .catch(err =>
                {
                    reject(err)
                });
        }
        else reject('Not connected');
    });
});

/** Event handler for deleting files on the remote server **/
ipcMain.handle('delete-file', async (_, directory, fileName) =>
{
    {
        [ directory ] = fmtPaths(directory);
        return new Promise((resolve, reject) =>
        {
            if ( isSSHConnected() )
            {
                console.error("Attempting to remove file: " + fileName + " from directory: " + directory);

                // Remove file.
                return ssh().execCommand(`cd ${directory} && rm -r '${fileName}'`)
                    .then(_ => resolve())
                    .catch(err =>
                    {
                        reject(err)
                    });
            }
            else reject('Not connected');
        });
    }
});

/** Event handler for retrieving the successful sessions in sessions.json **/
ipcMain.handle('retrieve-sessions', retrieveSessions);

/** Event handler for retrieving the status of the current SSH connection **/
ipcMain.handle('connection-status', isSSHConnected)

/**
 * Event handler for attempting to connect to a remote server.
 * The provided arguments can vary, depending on the requirements of the server.
 * When the connection is successful, the promise is resolved and the connection credentials
 * are saved locally in the sessions.json file.
 **/
ipcMain.handle('connect', async (_, host, username, password, port = 22, privateKey = null, passphrase = null) =>
{
    return new Promise((resolve, reject) =>
    {
        let cur = getCurrentSession();

        port ||= 22;

        // If the connection is already active and one is
        // trying to connect with the same credentials, resolve the promise.
        if ( (cur?.ssh.isConnected()) && cur.host === host && cur.username === username && cur.port === port )
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
                finish([ connection.password ])
        })
            .then(ssh =>
            {
                storeSession(connection); // store the session in sessions.json

                log('Connected to ' + host + ' with username ' + username + ' on port ' + port);

                connections.push(connection);
                currentConnection = connections.length - 1;
                resolve();

            })
            .catch(err => reject(err));
    })
})

/**
 *  Event handler for uploading multiple files
 *  @param {string} remoteDirectoryPath The directory to upload the files to.
 *  @param {string[]} files The files to upload.
 **/
ipcMain.handle('upload-files', async (_, remoteDirectoryPath, /** @type {string[]}*/ localAbsoluteFilePaths) =>
{
    // Format the path so that it's compatible with the remote server
    [ remoteDirectoryPath ] = fmtPaths(remoteDirectoryPath);

    return new Promise((resolve, reject) =>
    {
        // If there are no files to upload, resolve the promise with a message
        if ( localAbsoluteFilePaths.length === 0 )
            return resolve();

        if ( isSSHConnected() )
        {
            let opt = {
                step: (transfer_count, chunk, total) =>
                {
                    mainWindow.webContents.send('process-status',
                        { type: 'upload', progress: 100 * transfer_count / total, finished: transfer_count === total });
                }
            }

            // Go through all provided file arguments and check whether they are directories.
            // If this is the case, remove them from the list and call 'putDirectory' instead.
            for ( let i = 0; i < localAbsoluteFilePaths.length; i++ )
            {
                /** @type string */
                let filePath = localAbsoluteFilePaths[i];

                // Check if the file exists. If not, remove it from the transfer list
                // and continue.
                if ( !fs.existsSync(filePath) )
                {
                    localAbsoluteFilePaths.splice(i--, 1)
                    continue
                }

                // Check whether provided file is a directory
                if ( fs.lstatSync(filePath).isDirectory() )
                {
                    // Remove file from argument and call 'putDirectory' instead
                    localAbsoluteFilePaths.splice(i, 1);
                    ssh().putDirectory(filePath, path.join(remoteDirectoryPath, filePath.split('/').pop()), {
                        recursive: true,
                        concurrency: 10,
                        transferOptions: opt
                    })
                        .then(_ => resolve())
                        .catch(e => reject(e))
                }
            }

            // If there are no files to upload, resolve the promise.
            if ( localAbsoluteFilePaths.length === 0 )
                return resolve()

            log("Attempting to upload files to " + remoteDirectoryPath + ":", localAbsoluteFilePaths)
            // If there are still files to upload, call 'putFiles' to upload them.
            ssh().putFiles(localAbsoluteFilePaths.map(localPath =>
            {
                return { local: localPath, remote: path.join(remoteDirectoryPath, localPath.split('/').pop()) }
            }), {
                concurrency: 10,
                transferOptions: opt
            })
                .then(_ => resolve())
                .catch(e => reject(e))
        }
        else resolve('Not connected');
    })
})

/**
 * Event handler for moving files on the remote server.
 * If the file exists, it'll move it from the source directory to the target directory.
 */
ipcMain.handle('move-file', async (_, fileName, srcPath, dstPath) =>
{
    [ fileName, srcPath, dstPath ] = fmtPaths(fileName, srcPath, dstPath);
    return new Promise((resolve, reject) =>
    {
        if ( isSSHConnected() )
        {
            ssh().execCommand(`mv ${path.join(srcPath, fileName)} ${path.join(dstPath, fileName)}`)
                .then(_ => resolve())
                .catch(err => reject(err));
        }
        else reject('Not connected');
    })
})

/**
 * Event handler for renaming files on the remote server.
 * This handler attempts to rename a file on the remote server
 * in the provided path with the new name.
 */
ipcMain.handle('rename-file', async (_, directory, fileName, newName) =>
{
    [ directory, fileName, newName ] = fmtPaths(directory, fileName, newName);
    return new Promise((resolve, reject) =>
    {
        if ( isSSHConnected() )
        {
            ssh().execCommand(`cd ${directory} && mv ${fileName} ${newName}`)
                .then(_ => resolve())
                .catch(err => reject(err));
        }
        else reject('Not connected');
    })
})

/**
 * Event handler for navigating to the home directory.
 * When successful, it resolves the promise with an object containing
 * both the path and files in the home directory.
 * The following data will be returned:
 * {
 *     path: string,
 *     files: string[]
 * }
 **/
ipcMain.handle('starting-directory', async _ =>
{
    return new Promise((resolve, reject) =>
    {
        if ( isSSHConnected() )
        {
            ssh().execCommand('pwd && ls')
                .then(result => resolve({
                    path: result.stdout.split('\n')[0],
                    files: result.stdout.split('\n').slice(1)
                }))
                .catch(err => reject(err));
        }
        else reject('Not connected');
    })
});

/**
 * Event handler for creating a directory on the remote server.
 * This handler attempts to create a directory on the remote server
 * in the provided  directory with the provided name.
 **/
ipcMain.handle('create-directory', async (_, directory, dirName) =>
{
    [ directory ] = fmtPaths(directory);
    log(`Attempting to create dir at [${directory}] with name [${dirName}]`)
    return new Promise((resolve, reject) =>
    {
        if ( isSSHConnected() )
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
        }
        else reject('Not connected');
    })
});

ipcMain.handle('get-file-info', async (_, directory, fileName) =>
{
    [ directory, fileName ] = fmtPaths(directory, fileName)

    return new Promise((resolve, reject) =>
    {
        if ( isSSHConnected() )
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
        }
        else reject('Not connected');
    })
});

ipcMain.on('can-prompt-touch-id', (event) => event.returnValue = systemPreferences.canPromptTouchID());

ipcMain.handle('request-touch-id-auth', async (_, message) =>
{
    if ( !systemPreferences.canPromptTouchID() )
    {
        console.warn("Touch ID is not supported on this device.");
        return Promise.resolve();
    }
    return systemPreferences.promptTouchID(message);
})

ipcMain.on('current-session', (event) =>
{
    if ( !isSSHConnected() ) return event.returnValue = null;
    event.returnValue = {
        username: getCurrentSession().username,
        host: getCurrentSession().host,
        port: getCurrentSession().port
    };
})

ipcMain.handle('delete-session', (_, host, username) => deleteSession(host, username));

ipcMain.on('log', (_, message, ...args) => log(message, ...args));

ipcMain.handle('get-config', (event, fileName) =>
{
    let query = fileName.toUpperCase();
    if ( !FileNames[query] )
        throw new Error('Config file does not exist.');

    return loadFile(
        StaticFiles.includes(query) ?
            path.join(__dirname, 'resources', 'static', FileNames[query]) :
            path.join(RESOURCES_PATH, FileNames[query]))
});

/**
 * Method for checking the status of the current SSH connection.
 * @returns {boolean} Whether or not the connection is active.
 */
function isSSHConnected()
{
    return ssh()?.isConnected() || false;
}

/**
 * Function for retrieving the current session.
 * @returns {{ssh: NodeSSH, host: string, username: string, password: string, port: number, privateKey: string, passphrase: string}}
 */
function getCurrentSession()
{
    return connections[currentConnection];
}

/**
 * Function for retrieving the current SSH connection.
 * @returns {NodeSSH}
 */
function ssh()
{
    return getCurrentSession()?.ssh;
}

/**
 * Method for retrieving the successful sessions in sessions.json.
 * @returns {Promise<Object | Error>} A promise that resolves to the content of the sessions file.
 */
async function retrieveSessions()
{
    return new Promise((resolve, reject) =>
    {
        fs.readFile(path.join(RESOURCES_PATH, FileNames.SESSIONS), (err, data) =>
        {
            if ( err ) return reject(err);

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
 * @param {{host: string, username: string, password: string, port: number, privateKey: string | null, passphrase: string | null}} session
 * The connection object to update the sessions file with.
 */
function storeSession(session)
{

    // Get previous data
    fs.readFile(path.join(RESOURCES_PATH, FileNames.SESSIONS), (error, data) =>
    {
        if ( error )
        {
            console.error(error);
            throw error;
        }
        // Parse previous data
        let sessions = JSON.parse(data.toString());

        // Check if the connection is already in the sessions file, if not, add it.
        if ( !sessions.some(ses => ses.host === session.host && ses.username === session.username && ses.port === session.port) )
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

            // TODO: Encrypt the data before writing it to the file.

            // Write back to file
            fs.writeFile(path.join(RESOURCES_PATH, FileNames.SESSIONS), JSON.stringify(sessions), (err) =>
            {
                if ( err )
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
        if ( error )
            throw error;

        let sessions = JSON.parse(data.toString());
        let index = sessions.findIndex(session => session.host === host && session.username === username);
        if ( index !== -1 )
        {
            sessions.splice(index, 1);
            fs.writeFile(path.join(RESOURCES_PATH, FileNames.SESSIONS), JSON.stringify(sessions), (err) =>
            {
                if ( err ) throw err;
            })
        }
    })
}

/**
 * Method for formatting paths for the remote server.
 * Files containing spaces in the names are not handled properly when
 * handled in a terminal, therefore we'll have to format them to be compatible.
 * @param {string} paths The paths to format.
 * @returns {string[]} The formatted paths.
 */
function fmtPaths(...paths)
{
    return paths.map(p => p.replaceAll(' ', '\\ '));
}

