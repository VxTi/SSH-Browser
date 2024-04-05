/**
 * Implementation of the functionality for the external terminal.
 */

let { ClientChannel } = require('ssh2');
let { BrowserWindow } = require('electron');
let { createWindow } = require("./window.js");
let path = require('path');

/**
 * Function for initializing the external terminal.
 */
function __initialize() {

    /** @type {ClientChannel} */
    let outputStream;
    /** @type {ClientChannel} */
    let shellStream;
    /** @type {Electron.CrossProcessExports.BrowserWindow} */
    let associatedWindow;
    /** @type {string[]} */
    let messageQueue = [];
    let windowLoaded = false;
    /** @type {Function[]} */
    let inputHandlers = [];

    let ansiConverter = new (require('ansi-to-html'))({ newline: true, escapeXML: false, stream: false });

    /**
     * Function for creating a new terminal window.
     */
    function createTerminalWindow()
    {
        associatedWindow = createWindow(path.join(__dirname, './page-external-terminal.html'), {
            width: 600,
            height: 480
        });
        associatedWindow.webContents.on('did-finish-load', () => {
            windowLoaded = true;
            __flushMessageQueue();
        });
        // If the window is closed, end the shell stream.
        associatedWindow.on('closed', () => {
            shellStream.end();
            associatedWindow = null;
            outputStream = null;
        });
    }

    /**
     * Function for focussing the terminal window, if it exists.
     * The function returns true if the window was focused, and false if the window
     * does not exist.
     */
    function focusTerminalWindow()
    {
        if ( associatedWindow )
        {
            associatedWindow.focus();
            return true;
        }
        return false;
    }

    /**
     * Function for flushing the message queue.
     */
    function __flushMessageQueue()
    {
        messageQueue.forEach(__handleReceivedMessage);
        messageQueue = [];
    }

    /**
     * Function for writing command output to the terminal.
     * @param {string} output The output to write to the terminal.
     */
    function write(output)
    {
        if ( shellStream )
        {
            shellStream.stdout
                .pause()
                .write(output, 'utf-8', _ => shellStream.stdout.resume());
        }
    }

    /**
     * Function for attaching a shell stream to the terminal.
     * @param {ClientChannel} stream The shell stream to attach to the terminal.
     */
    function attachShellStream(stream)
    {
        shellStream = stream;
        shellStream.on('data',
            data => __handleReceivedMessage(ansiConverter.toHtml(data.toString())));
        return this;
    }

    /**
     * Function for handling a received message.
     * @param {string} message The message that was received.
     */
    function __handleReceivedMessage(message)
    {

        // Check if the window is loaded and if there is an associated window.
        if ( associatedWindow && windowLoaded)
        {
            // If the window is destroyed, end the shell stream.
            if (associatedWindow.isDestroyed())
            {
                shellStream.end();
                return;
            }
            associatedWindow.webContents.send('message-received', message);
            inputHandlers.forEach(handler => handler(message));
        }
        else
        {
            // If the window is not yet loaded, queue the message.
            messageQueue.push(message);
        }
    }

    /**
     * Function for adding an input handler.
     * This function is called every time a message is received
     * from the host.
     * @param {Function} handler The handler to add.
     * @returns The index of the handler in the handler array.
     */
    function addInputHandler(handler)
    {
        inputHandlers.push(handler);
        return inputHandlers.length - 1;
    }

    /**
     * Function for removing an input handler.
     * @param {number} index The index of the handler to remove.
     */
    function removeInputHandler(index)
    {
        if ( inputHandlers[index] )
            inputHandlers.splice(index, 1);
    }

    /**
     * Function for setting the shell window size.
     * @param {number} rows The number of rows in the shell window.
     * @param {number} columns The number of columns in the shell window.
     * @param {number} width The width of the shell window.
     * @param {number} height The height of the shell window.
     */
    function setShellWindowSize(rows, columns, width, height)
    {
        if ( shellStream )
            shellStream.setWindow(rows, columns, height, width);
        else throw new Error('No shell stream attached.');
    }

    // Provide the importee with the necessary functions.
    return {
        createTerminalWindow,
        attachShellStream,
        write,
        setShellWindowSize,
        addInputHandler,
        removeInputHandler,
        focusTerminalWindow
    }
}

module.exports = __initialize();