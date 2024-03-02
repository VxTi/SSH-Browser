/** - - - - - - - - - - - - - - - - - - - - - - - - - - **
 * This file contains the logic behind the file editor.  *
 * @author Luca Warmernhoven                             *
 * @date 29 / 02 / 2024                                  *
 ** - - - - - - - - - - - - - - - - - - - - - - - - - - **/

/** File extensions for different rendering methods **/
const __fileImageExtensions = [ 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg' ];
const __fileAudioExtensions = [ 'mp3', 'wav', 'ogg', 'flac' ];
const __fileVideoExtensions = [ 'mp4', 'webm', 'ogg' ];

let pageContent = [ '' ];

// Cursor position
let cursor = { x: 0, y: 0 };

// File indentation. Default is 4 spaces
let __indentation = 4;

/** @type {'local' | 'remote'} **/
let __fileOrigin = 'local';

/** @type {string} **/
let
    __originPath,
    __targetPath,
    __fileName,
    __fileExtension;

/** @type {'text' | 'image' | 'audio' | 'video'} */
let __displayType = 'text';

/** @type {{context: {origin: 'local' | 'remote', originPath: string, targetPath: string, fileName: string, content: string}}}**/
let fileContexts = {};

const ActionHistory = { undo: [], redo: [] };
const maxHistoryLength = 100;

/**
 * Registration of event handlers for when the file editor opens.
 */
window.events.on('file-editor-acquire-context', (context) => {
    const contextId = Math.random().toString(16).substring(9);
    fileContexts[contextId] = context;

    // Add file to the file list
    let fileElement = document.createElement('div');
    fileElement.classList.add('action', 'open-file', 'content-text');
    fileElement.innerText = __fileName;
    fileElement.setAttribute('context-id', contextId);
    fileElement.title = (__targetPath + '/' + __fileName).replace(/\/\//g, '/');
    document.getElementById('open-file-container').appendChild(fileElement);

    __switchContext(contextId);

})
window.events.on('file-editor-set-indentation', (indentation) => __indentation = indentation);

function __switchContext(contextId)
{
    let context = fileContexts[contextId];
    __fileOrigin    = context.origin;
    __originPath    = context.originPath;
    __targetPath    = context.targetPath;
    __fileName      = context.fileName;
    __fileExtension = context.fileName.split('.').pop();
    __displayType   = __getDisplayType(__fileExtension);
    pageContent     = context.content.split('\n');
    document
        .querySelectorAll('.open-file')
        .forEach(element => element.removeAttribute('selected'));
    document
        .querySelector(`open-file[context-id="${contextId}"]`)
        ?.setAttribute('selected', '');
    __updatePageContent(-1);
}

document.addEventListener('DOMContentLoaded', () =>
{
    // Save the elements to the window object for later use.
    window.eEditorContentContainer = document.getElementById('file-editor-content');
    window.eLineNumbersContainer = document.getElementById('line-numbers-container');
    window.eCursor = document.getElementById('cursor');
    window.eCursorPosition = document.getElementById('cursor-position');

    // Add functionality for action buttons
    document
        .getElementById('save-file')
        .addEventListener('click', async _ =>
        {
            await __saveFile(
                origin => console.error('Failed to save file to ' + origin),
                origin => console.log('File saved on ' + origin)
            );
        })

    document
        .getElementById('action-reload')
        .addEventListener('click', async _ => await __reloadFile())

    document
        .querySelectorAll('.open-file')
        .forEach(element =>
            element.addEventListener('click', _ => __switchContext(element.getAttribute('context-id'))))

});

document.addEventListener('click', (e) =>
{
    if ( e.target.classList.contains('line-content') )
    {
        cursor.y = parseInt(e.target.dataset.lineNumber) - 1;
        cursor.x = e.target.innerText.length;
        __updateCursorScreenPos();
        console.log("Clicked on line number");
    }
    console.log("Test", e)
});

document.addEventListener('keydown', (e) =>
{
    e.preventDefault();
    const doSpecial = (e.ctrlKey || e.metaKey);
    switch ( e.key )
    {
        case "ArrowLeft":
            __translateCursor(doSpecial ? -cursor.x : -1, 0);
            break;
        case "ArrowRight":
            __translateCursor(doSpecial ? pageContent[cursor.y].length - 1 - cursor.x : 1, 0);
            break;
        case "ArrowUp":
            __translateCursor(0, -1);
            break;
        case "ArrowDown":
            __translateCursor(0, 1);
            break;
        case "Tab":
            __insertChars((" ").repeat(cursor.x % __indentation || __indentation));
            break;
        case "Backspace":
            __deleteChars(doSpecial ? 0 : 1);
            break;
        case "Enter":
            __insertChars('\n');
            break;
        default:
            if ( e.key.length === 1 )
                __insertChars(e.key);
            break;
    }
})

function __translateCursor(dx, dy)
{
    // If the cursor is underflowing on the line, we try to move it a line up.
    if ( cursor.x + dx < 0 )
    {
        // Check if there's lines available above
        if ( cursor.y > 0 )
        {
            cursor.y--;
            cursor.x = pageContent[cursor.y].length;
        }
    } // If it's overflowing on the line, we try to move it a line down.
    else if ( cursor.x + dx > pageContent[cursor.y].length )
    {
        // Check if there's lines available underneath
        if ( cursor.y + 1 < pageContent.length )
        {
            cursor.y++;
            cursor.x = 0;
        }
    } else // Translate the cursor normally (x)
    {
        cursor.x += dx;
    }
    cursor.y = Math.max(0, Math.min(pageContent.length - 1, cursor.y + dy));
    __updateCursorScreenPos();
}

/**
 * Function for inserting characters into the page content.
 * Automatically updates the cursor position.
 * @param {string} content The content to insert
 * @private
 */
function __insertChars(content)
{
    let newLines = content.split('\n');
    if ( newLines > 1 )
    {
        // TODO: Fix this
        cursor.x = 0;
    } else
    {
        pageContent[cursor.y] = pageContent[cursor.y].slice(0, cursor.x) + content + pageContent[cursor.y].slice(cursor.x);
        cursor.x += content.length;
    }
    __updatePageContent(newLines.length > 1 ? -1 : cursor.y);
    __updateCursorScreenPos();
}


/**
 * Function for deleting a set number of characters from the page
 * @param {number} [deleteCount = 1] How many characters to delete.
 * Will delete the whole line if set to <= 0
 * Automatically updates the cursor position.
 * @private
 */
function __deleteChars(deleteCount = 1)
{
    // If delete count < 0, we'll delete the whole line
    deleteCount = deleteCount <= 0 ? pageContent[cursor.y].length : deleteCount || 1;

    // Check if we're trying to delete a whole line
    if ( cursor.x - deleteCount <= 0 )
    {
        // Check if we have more lines available
        if ( cursor.y > 0 && pageContent.length > 1 )
        {
            // Delete the lines
            cursor.x = pageContent[cursor.y - 1].length;
            pageContent[cursor.y - 1] += pageContent[cursor.y];
            pageContent.splice(cursor.y, 1);
            cursor.y--;
        }
    } else
    {
        pageContent[cursor.y] = pageContent[cursor.y].slice(0, cursor.x - deleteCount - 1) + pageContent[cursor.y].slice(cursor.x);
        cursor.x -= deleteCount;
    }
    __updatePageContent(cursor.y);
    __updatePageContent(cursor.y + 1);
    __updateCursorScreenPos();
}

/**
 * Function for parsing specific sections of file content onto the page.
 * This function converts the raw text data into HTML elements.
 * @param {number} lineIndex The line index to parse. Use -1 for all lines.
 */
function __updatePageContent(lineIndex = -1)
{
    console.log("Updating page content");
    // If the index is out of range, don't do anything.
    if ( lineIndex + 1 > pageContent.length )
        return;

    // Update content of a specific line
    if ( lineIndex > -1 )
    {
        document.querySelector('.line-content[data-line-number="' + (lineIndex + 1) + '"]').innerHTML =
            window["codeHighlighting"]
                .highlight(pageContent[lineIndex], __fileExtension);
    } else
    {
        // Update the entire page
        eEditorContentContainer.innerHTML =
            window["codeHighlighting"]
                .highlight(pageContent.join('\n'), __fileExtension)
                .split('\n')
                .map(line => `<div class="line-content content-text">${line || '<br>'}</div></div>`)
                .join('');
        __updateLineNumbers();
    }
}

/**
 * Function for moving the cursor across the document.
 * @private
 */
function __updateCursorScreenPos()
{
    const lineElement = document.querySelector(`.line-content[data-line-number="${cursor.y + 1}"]`);
    const clientPosition = lineElement.getBoundingClientRect();
    eCursor.innerText = lineElement.innerText.slice(0, cursor.x).replaceAll(' ', '\u00A0');
    eCursor.transform = `translateX(${clientPosition.left}px) translateY(${clientPosition.top}px)`;
    eCursorPosition.innerText = `Ln ${cursor.y + 1}, Col ${cursor.x + 1}`;
}

/**
 * Function for updating the line numbers on the page.
 * @private
 */
function __updateLineNumbers()
{
    let lineNumberElements = eLineNumbersContainer.querySelectorAll('.line-number-element');

    // If there's less line numbers elements than needed,
    // we'll generate them.
    if ( lineNumberElements.length < pageContent.length )
    {
        for ( let i = 0; i < pageContent.length - lineNumberElements.length; i++ )
        {
            let lineNumber = document.createElement('div');
            lineNumber.classList.add('line-number-element', 'content-text');
            eLineNumbersContainer.appendChild(lineNumber);
        }
    } // If there's too many, we'll have to remove some.
    else if ( lineNumberElements.length > pageContent.length )
    {
        for ( let i = 0; i < lineNumberElements.length - pageContent.length; i++ )
            lineNumberElements[lineNumberElements.length - 1].remove();
    }

    // Updates the line numbers of the text content.
    document.querySelectorAll('.line-content')
        .forEach((element, i) => element.dataset.lineNumber = `${i + 1}`);
}

/**
 * Saves the file either locally or remotely, depending on where
 * the file is located. (This depends on the <code>__fileOrigin</code> variable) <br>
 * If the file is located on the server, the callback functions will be
 * called twice, where the provided function parameter will be 'remote' and 'local',
 * depending on the success of the operation.
 * @returns {Promise<boolean>}
 * @private
 */
async function __saveFile(errorCallback = null, successCallback = null)
{
    // Ensure that we can save the file to the target path
    if ( !__targetPath || !__originPath || !__fileName )
        throw new Error(`Cannot save file to ${__fileOrigin}, origin-, target-path or file-name is not set.`);

    // If the file originates from a remote host,
    // we'll upload the saved changes to the server.
    if ( __fileOrigin === 'remote' )
    {
        // First save local changes
        await window.localFs.saveFile(
            __originPath + '/' + __fileName,
            pageContent.join("\n")
        )
            .then(_ => successCallback && successCallback('local'))
            .catch(_ => errorCallback && errorCallback('local'));

        await window.ssh.uploadFiles(__originPath, [ __targetPath + '/' + __fileName ])
            .then(_ => successCallback && successCallback('remote'))
            .catch(_ => errorCallback && errorCallback('remote'));
    }
    else // File is stored locally
    {
        // Save the file locally to the target path (can be the same as the origin path)
        await window.localFs.saveFile(
            __targetPath + '/' + __fileName,
            pageContent.join("\n")
        )
            .then(_ => successCallback && successCallback('local'))
            .catch(_ => errorCallback && errorCallback('local'));
    }
}

async function __reloadFile()
{
    // TODO: Add implementation.
}

/**
 * Function for retrieving the display type for the provided file.
 * This display type is based on the file extension.
 * @param {string} fileName The name of the file.
 * @returns {'text' | 'image' | 'audio' | 'video'} The display type for the file.
 */
function __getDisplayType(fileName)
{
    let extension = fileName.split('.').pop();
    if ( __fileImageExtensions.includes(extension) )
        return 'image';
    if ( __fileAudioExtensions.includes(extension) )
        return 'audio';
    if ( __fileVideoExtensions.includes(extension) )
        return 'video';
    return 'text';
}