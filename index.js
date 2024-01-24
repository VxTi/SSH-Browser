const { app, BrowserWindow } = require('electron')
const { dialog } = require('electron');

const fs = require('fs')
const path = require('node:path')
const {NodeSSH} = require('node-ssh')
const menu = require('electron').Menu;
const { v4: uuidv4 } = require('uuidv4')
const ipcMain = require('electron').ipcMain;


let connection = null;

const sessionsFile = 'sessions.json';
let sessionsPath = path.join(__dirname, sessionsFile);

 // E+OG3S3pUoksEX

const windowOptions = {
    width: 800,
    height: 600,
    transparent: true,
    movable: true,
    titleBarOverlay: true,
    titleText: 'SSH Client',
    titleBarStyle: 'customButtonsOnHover',
    webPreferences: {
        nodeIntegration: false, // is default value after Electron v5
        contextIsolation: true, // protect against prototype pollution
        enableRemoteModule: false, // turn off remote
        preload: path.join(__dirname, "preload.js") // use a preload script
    }
}

let window;

let _clog = console.log;
console.log = function(...args) { _clog(...args); }

function createWindow() {
    window = new BrowserWindow({
        width: 800,
        height: 600,
        transparent: true,
        movable: true,
        titleBarOverlay: true,
        titleBarStyle: 'customButtonsOnHover',
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            preload: path.join(__dirname, "preload.js") // use a preload script
        }
    });

    //menu.setApplicationMenu(menu.buildFromTemplate(menuTemplate));

    // Check for the existence of the sessions file.
    // If it does not exist, create it.
    if (!fs.existsSync(sessionsPath)) {
        console.log("Creating file");
        fs.writeFile(sessionsPath, JSON.stringify([]), (err) => {
            if (err) throw err;
        })
        // It does exist, so we'll parse its contents.
    } else {
        fs.readFile(sessionsPath, (error, data) => {
            if (error)
                throw error;

            let sessions = JSON.parse(data.toString());

            if (sessions.length > 0) {
                console.log(sessions);
            }
        })
    }

    window.setWindowButtonVisibility(true);
    window.on('before-quit', () => {
        window.webContents.send('exit');
    })

    window.loadFile('./index.html')
        .then(() => {
            console.log('Loaded index.html')
        })
        .catch((err) => console.error(err));
}

app.on('ready', createWindow);
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit()
})


/**
 * Listener for uploading multiple files into the directory.
 * This event listener accepts 'args' in the following format:
 * args[0]: string   - Path to transfer to (remote)
 * args[1]: string[] - Paths to the files to transfer (local)
 */
ipcMain.on('upload-files', async (event, args) => {
    if (!args || args.length < 2)
        throw new Error('Invalid arguments for event \'upload-files\', args expected as array, but received ' + typeof args);

    if (connection != null && connection.ssh.isConnected()) {
        let paths = args[1];
        let destination = args[0];

        await connection.ssh.putFiles(paths.map(path => {
            return {local: path, remote: destination + '/' + path.split('/').pop()}
        }))
            .then(result => window.webContents.send('upload-files-response', [true]))
            .catch(e => window.webContents.send('upload-files-response', [false, e?.message + ' - ' + e?.cause + ': ' + e?.stack]))
    }
})

/**
 * Event listener for getting the connection status of the current SSH session.
 * This listener returns a boolean when called with 'ipc.sendSync(...)'
 */
ipcMain.on('connection-status', (event, args) => {
    event.returnValue = getCurrentSession().isConnected();
})

/**
 * Event listener for attempting to log in to a new SSH session.
 * Since we want a loading animation, we do this asynchronously.
 */
ipcMain.on('connect', (event, args) => {
    connection = session(args[0], args[1], args[2]);

    connection.ssh.connect({
            host: connection.host,
            username: connection.username,
            password: connection.password,
            port: connection.port,
            tryKeyboard: true,

            onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
                finish([connection.password]);
            }
        })
        .then(ssh => {
            window.webContents.send('connection-response', [true])
            updateSessions(connection);
        })
        .catch(err => window.webContents.send('connection-response', [false, err]));
})

/**
 * Handler for selecting files from the OS's file manager.
 * Upon completion, it fires another event named 'select-files-response'
 */
ipcMain.on('open-files', (event, args) => {
    dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
        .then(result => {

            // Only send a response when the user has actually selected any files.
            if (result.filePaths.length > 0)
                window.webContents.send('open-files-response', result.filePaths)
        })
        .catch(err => window.webContents.send('open-files-response', err));
})

/**
 * Event handler for listing files in a provided path.
 * Path resides in 'args[0]', which is a string literal.
 * Path must be provided as an absolute; not relative.
 * If the query is successful, the response event will be called; 'listFilesResponse'.
 * If the query is unsuccessful, the error event will be called; 'listFilesError'.
 */
ipcMain.on('listFiles', (event, args) => {

    // Check whether the provided argument is a string or not.
    // If this is not the case, do not proceed.
    if (! (typeof args[0] === 'string' || args[0] instanceof String)) {
        console.error('listFiles: args is not a string');
        return;
    }

    // Check whether there's an active connection.
    // If this is the case, we move to the provided directory and list its files
    // We return the retrieved files in a 'listFilesResponse' event, with two arguments:
    // arg[0]: the absolute path of the directory
    if (getCurrentSession().isConnected()) {
        getCurrentSession().execCommand('cd ~ && cd ' + args[0] + ' && ls')
            .then(result => event.returnValue = result.stdout)
            .catch(err => event.returnValue = err);
    }
});

/**
 * Event handler for retrieving the current working directory.
 * This returns a string with the result, when called with 'ipc.sendSync(...)'
 */
ipcMain.on('listDirectory', (event, args) => {
    if (getCurrentSession().isConnected()) {
        getCurrentSession().execCommand('pwd')
            .then(result => event.returnValue = result.stdout)
            .catch(err => event.returnValue = err);
    }
})

ipcMain.on('addFile', (event, args) => {
    if (getCurrentSession().isConnected()) {
        getCurrentSession().putFile(args[0], args[1])
            .then(result => event.returnValue = result)
            .catch(err => event.returnValue = err);
    }
})

/**
 * Event handler for 'delete-file' request.
 * args must be an array
 * args[0] must be directory
 * args[1] must be file to delete.
 */
ipcMain.on('delete-file', (event, args) => {
    if (getCurrentSession().isConnected()) {
        console.error("Attempting to remove file: " + args[1] + " from directory: " + args[0]);

        // Remove file.
        getCurrentSession().execCommand(`cd ~ && cd ${args[0]} && rm -r '${args[1]}'`)
            .then(result => window.webContents.send('delete-file-response', [true]))
            .catch(err => window.webContents.send('delete-file-response', [false, err]));
    }
})

/**
 * Event listener for retrieving HTML template data.
 * This is to inhibit usage of iframes
 * Args provided are in the following format:
 * args[0]: page identifier
 * args[1]: page template path
 * This in turn calls an event 'retrieveTemplateResponse', which provides the following arguments:
 * args[0]: page identifier
 * args[1]: page template content
 */
ipcMain.on('retrieveTemplate', (event, args) => {
    fs.readFile(path.join(app.getAppPath(), args[0]), (err, data) => {
        event.returnValue = err || data.toString();
    })
});

/**
 * Method for retrieving the current SSH session.
 * Currently returns the NodeSSH object.
 * Future proofing for possible changes.
 * @returns {NodeSSH} the current SSH session.
 */
function getCurrentSession() {
    return connection.ssh;
}

/**
 * Method for creating a new SSH session.
 * @param {string} host The host for the SSH session. Can be either an IP address or a domain name.
 * @param {string} username The username for the SSH session.
 * @param {string} password The password for the SSH session.
 * @param {number} port The port for the SSH session. Default is 22.
 * @returns {{password, port, host, connect: (function(...[*]): *), username}}
 */
function session(host, username, password, port = 22) {
    return {
        ssh: new NodeSSH(),
        port: port,
        host: host,
        username: username,
        password: password,
        privateKey: null,
    }
}

function updateSessions(connection) {

    fs.readFile(sessionsPath, (error, data) => {
        if (error)
            throw error;

        let sessions = JSON.parse(data.toString());

        sessions.push({
            id: uuidv4(),
            host: connection.host,
            username: connection.username,
            password: connection.password,
            port: connection.port,
            privateKey: connection.privateKey
        });

        fs.writeFile(sessionsPath, JSON.stringify(sessions), (err) => {
            if (err) throw err;
        })
    })
}