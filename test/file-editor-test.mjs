
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')

function createWindow(pagePath = null, createArgs = {})
{
    pagePath ||= path.join(__dirname, 'index.html');
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
        },
        ...createArgs
    });

    // Show the window buttons on macOS
    if ( OS.isMac )
        window.setWindowButtonVisibility(true);

    window.loadFile(pagePath).catch(console.error);

    return window;
}
