/**
 * The main file for the SSH client.
 *
 * @Author Luca Warmenhoven
 * @Date 14 / 02 / 2024
 */
const { app, BrowserWindow, ipcMain, dialog, systemPreferences } = require('electron')
const fs = require('fs')
const path = require('node:path')
const { NodeSSH } = require('node-ssh')
const extTerm = require('./utilities/external-terminal.js');
const { pushSession, getSessions, popSession } = require('./utilities/sessions');
const { createWindow, System } = require('./utilities/window.js');

const FileNames = {
    KEYBINDS: 'keybinds.json',
    SESSIONS: 'sessions.json',
    FILE_ICONS: 'file_icons.json'
}

const StaticFiles = [ 'FILE_ICONS' ]

const RESOURCES_PATH = path.join(app.getPath('appData'), app.getName());

/** List of open connections
 * @type {{ssh: NodeSSH, session: ISSHSession}[]}*/
let connections = [];
let currentConnection = 0;

// Window variables
let mainWindow = null;
let fileEditorWindows = [];

function log(message, ...args)
{
    let timeStamp = new Date();
    console.log(
        `${timeStamp.toLocaleDateString('en-UK')} ${timeStamp.toLocaleTimeString('en-UK')} | ${message}`,
        ...args);
}

/**
 * When the app has successfully initialized, we can load some other things.
 * Example, creating the necessary files in the file system, if not present.
 */
app.whenReady().then(() =>
{
    // Create directory for storing SSH client data
    if ( !fs.existsSync(RESOURCES_PATH) )
        fs.mkdirSync(RESOURCES_PATH)

    // If the sessions page doesn't exist yet, create it, and show the user
    // the 'welcome' screen.
    if ( !fs.existsSync(path.join(RESOURCES_PATH, FileNames.SESSIONS)) )
        fs.writeFileSync(path.join(RESOURCES_PATH, FileNames.SESSIONS), JSON.stringify([]));

    mainWindow = createWindow();
    mainWindow.setMinimumSize(600, 500);

    app.on('activate', _ =>
    {
        if ( BrowserWindow.getAllWindows().length === 0 )
            createWindow();
    })
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
            return reject("File does not exist: ", path);

        fs.readFile(path, 'utf-8', (err, data) =>
        {
            if ( err )
                return reject(err);
            resolve(data);
        });
    });
}

// Quits the application if all windows are closed (windows & linux)
app.on('window-all-closed', () => System.isMac || app.quit())

/**
 * Handler for opening an external terminal window, with a provided directory.
 * This handler then connects a shell to that window every time the window is opened.
 */
ipcMain.on('open-terminal', async (_, directory) =>
{
    if (!extTerm.focusTerminalWindow())
    {
        // Create a new shell connection
        ssh()
            .requestShell({ term: process.env.TERM || 'xterm-256color' })
            .then((stream) =>
            {
                extTerm.createTerminalWindow();
                extTerm.attachShellStream(stream);
                extTerm.setShellWindowSize(80, 24, 480, 600);
                extTerm.write('cd ' + directory + '\n');

            })
            .catch(e => log("An error occurred whilst requesting shell", e));
    }
});

ipcMain.handle('external-terminal-send-command', (_, message) => extTerm.write(message));

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
        targetWindow = createWindow(path.join(__dirname, '../pages/page-external-file-editor.html'), {
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
ipcMain.handle('localFs:save-file', async (_, absolutePath, content) =>
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
ipcMain.handle('localFs:rename-file', async (_, localPath, oldFileName, newFileName) =>
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
 * Event handler for listing files in a directory on the local file system.
 */
ipcMain.handle('localFs:list-files', async (_, path) => {
    return new Promise((resolve, reject) =>
    {
        fs.readdir(path, (err, files) =>
        {
            if ( err )
            {
                log('An error occurred whilst attempting to list files:', err);
                reject(err);
            }
            else resolve(files);
        })
    });
})

/**
 * Event handler for the 'select files' dialog menu
 **/
ipcMain.handle('open-files', async (properties) =>
{
    return new Promise((resolve, reject) =>
    {
        if ( isSSHConnected() )
        {
            dialog.showOpenDialog(properties || { properties: [ 'openFile', 'multiSelections' ] })
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
ipcMain.handle('retrieve-sessions', getSessions);

/** Event handler for retrieving the status of the current SSH connection **/
ipcMain.handle('connection-status', isSSHConnected)

/**
 * Event handler for attempting to connect to a remote server.
 * The provided arguments can vary, depending on the requirements of the server.
 * When the connection is successful, the promise is resolved and the connection credentials
 * are saved locally in the sessions.json file.
 **/
ipcMain.handle('connect', async (_, properties) =>
{
    return new Promise((resolve, reject) =>
    {
        let cur = getCurrentSession();

        // If the connection is already active and one is
        // trying to connect with the same credentials, resolve the promise.
        if ( (cur?.ssh.isConnected()) && cur?.session.host === properties.host && cur.session.username === properties.username && cur?.session.port === properties.port )
        {
            currentConnection = connections.indexOf(cur);
            log('Connection already active');
            return resolve();
        }

        log('Attempting to connect to ' + properties.host + ' with username ' + properties.username + ' on port ' + properties.port);

        let connection = {
            ssh: new NodeSSH(),
            session: properties
        }

        connection.ssh.connect({
            host: properties.host,
            privateKey: properties?.privateKey,
            username: properties?.username || '',
            password: properties?.password,
            port: properties?.port || 22,
            passphrase: properties?.passphrase,
            tryKeyboard: true,

            onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) =>
                finish([ connection.password ])
        })
            .then(ssh =>
            {
                pushSession(properties); // store the session in sessions.json

                log('Connected to ' + properties.host + ' with username ' + properties.username + ' on port ' + properties.port);

                connections.push({ ssh: ssh, session: properties});
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
    return systemPreferences.promptTouchID(message)
        .then(_ => true)
        .catch(_ => false)
})

ipcMain.on('current-session', (event) =>
{
    event.returnValue = isSSHConnected() ? {
        username: getCurrentSession().session.username,
        host: getCurrentSession().session.host,
        port: getCurrentSession().session.port
    } : null;
})

ipcMain.handle('delete-session', (_, host, username, port) => popSession({ host: host, username: username, port: port}));

ipcMain.on('log', (_, message, ...args) => log(message, ...args));

ipcMain.handle('get-config', (event, fileName) =>
{
    let query = fileName.toUpperCase();
    if ( !FileNames[query] )
        throw new Error('Config file does not exist.');

    return loadFile(
        StaticFiles.includes(query) ?
            path.join(__dirname, '../resources', 'static', FileNames[query]) :
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
 * @returns {{ssh: NodeSSH, session: ISSHSession} | null}
 */
function getCurrentSession()
{
    return connections[currentConnection] || null;
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

