let { BrowserWindow } = require('electron');
let path = require('path');
let os = require('os');

/**
 * Function for creating a window with the given page path and creation arguments.
 * These can be left empty for default settings.
 * @param pagePath
 * @param createArgs
 * @returns {Electron.CrossProcessExports.BrowserWindow}
 */
function createWindow(pagePath = path.join(__dirname, '..', 'index.html'), createArgs = {})
{
    let window = new BrowserWindow({
        width: 900,
        height: 700,
        transparent: true,
        titleBarOverlay: false,
        show: false,
        icon: './resources/app_icon.png',
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js")
        },
        ...createArgs
    });

    // Show the window buttons on macOS
    if ( os.platform() === 'darwin' )
        window.setWindowButtonVisibility(true);

    window.webContents.on('did-finish-load', _ => window.show());
    window.loadFile(pagePath).catch(console.error);

    return window;
}

/** Export the system information. */
const System = {
    isWindows: os.type() === 'Windows_NT',
    isMac: os.type() === 'Darwin',
    isLinux: os.type() === 'Linux'
}

module.exports = { createWindow, System };