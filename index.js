const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('node:path')
const {NodeSSH} = require('node-ssh')
const menu = require('electron').Menu;
const { v4: uuidv4 } = require('uuidv4')
const ipcMain = require('electron').ipcMain;



const ssh = new NodeSSH()

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

const menuTemplate =[
    {
        label: 'Sample',
        submenu: [
            { label: 'About App', selector: 'orderFrontStandardAboutPanel:'},
            {
                label: 'Quit',
                accelerator: 'CmdOrCtrl+Q',
                click: function() {
                    app.quit();
                }
            }
        ]
    }
];

let window;

let _clog = console.log;
console.log = function(...args) { _clog(...args); window.webContents.send('log', args); }

function createWindow () {
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
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

/**
 * Event listener for attempting to log in to a new SSH session.
 */
ipcMain.on('attemptLogin', (event, args) => {
    window.webContents.send('loginAttempt');
    ssh.connect({
        host: args[0],
        username: args[1],
        password: args[2]
    }).then(async () => {

        await ssh.execCommand('pwd && ls')
            .then((result) => {
                let directory = result.stdout.split('\n').shift();
                let files = result.stdout.split('\n').slice(1).join('\n');
                window.webContents.send('loginSuccess', [directory, files]);
            }).catch((err) => {
                window.webContents.send('loginFailed', err);
            });
    }).catch((err) => {
        window.webContents.send('loginFailed', err)
    })
})

/**
 * Event handler for listing files in a provided path.
 * Path resides in 'args', which is a string literal.
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
    // arg[1]: the files in the directory
    if (ssh.isConnected()) {
        ssh.execCommand('cd ~ && cd ' + args[0] + ' && ls')
            .then((result) => {
                window.webContents.send('listFilesResponse', [args[0], result.stdout])
            })
            .catch((err) =>
                window.webContents.send('listFilesError', err))
    }
})

ipcMain.on('addFile', (event, args) => {
    if (ssh.isConnected()) {
        ssh.putFile(args[0], args[1])
            .then((result) =>
                window.webContents.send('addFileResponse', result))
            .catch((err) =>
                window.webContents.send('addFileResponse', err))
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
    fs.readFile(path.join(app.getAppPath(), args[1]), (err, data) => {
        window.webContents.send('retrieveTemplateResponse', [args[0], err || data.toString()])
    })
});

/*
function createSession() {
    let uuid = uuidv4();
    let session = new SSHSession(uuid, ssh);
    ssh_sessions[`session_${uuid}`] = session;
    return session;
}

/!**
 * Method for retrieving an SSH Session by its UUID.
 * @param {string} uuid The UUID of the SSH Session
 * @returns {*}
 *!/
function getSession(uuid) {
    return ssh_sessions[`session_${uuid}`];
}*/
