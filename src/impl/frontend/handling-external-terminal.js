/** - - - - - - - - - - - - - - - - - - - - - - - **
 | Here lies the implementation of inner terminal. |
 ** - - - - - - - - - - - - - - - - - - - - - - - **/

/**
 * The buffer containing the terminal's output data.
 * @type string[]
 */
let contentBuffer = [];

/**
 * The limit as to how many rows the terminal can hold.
 * @type {number}
 */
const maxRows = 4096;

/**
 * The element which holds the terminal text.
 * @type Element
 */
let terminalContentElement;

/**
 * The position of the cursor in the terminal.
 */
let cursorPosition = { x: 0, y: 0, verticalOffset: 0 };

/**
 * The dimensions of the terminal (characters)
 */
let dimensions = { columns: 80, rows: 24 };

/**
 * Empty function representing no operation
 */
const NO_OP = () =>
{
};

/**
 * A map containing special characters and their corresponding ANSI codes.
 * These are the names for the key events that are fired, which are not
 * regular characters.
 */
let SpecialCharMap = {
    'ArrowUp': {
        sends: '\x1b[A', executes: () => moveCursor(0, -1)
    },
    'ArrowDown': {
        sends: '\x1b[B', executes: () => moveCursor(0, 1)
    },
    'ArrowLeft': {
        sends: '\x1b[D', executes: () => moveCursor(-1, 0)
    },
    'ArrowRight': { sends: '\x1b[C', executes: () => moveCursor(1, 0) },
    'Backspace': {
        sends: '\x1b[D\0', executes: () =>
        {
            let index = cursorPosition.y + cursorPosition.verticalOffset;

            // Ensure index is within bounds and that there's something to delete
            if ( (cursorPosition.x === 0 && index === 0) || index < 0 || index > contentBuffer.length )
                return;

            moveCursor(-1, 0);
            putString('', index, cursorPosition.x, false);
        }
    },
    'Enter': { sends: '\n', executes: () => moveCursor(0, 1)},
    'Control': { sends: '\x1b' },
    'Tab': { sends: '\t' },
    'Escape': { sends: '\x1b' }
};


document.addEventListener('DOMContentLoaded', _ =>
{

    terminalContentElement = document.querySelector('.terminal-content');

    // Add all rows
    for ( let i = 0; i < dimensions.rows; i++ )
    {
        let rowElement = document.createElement('span');
        rowElement.classList.add('terminal-row');
        terminalContentElement.appendChild(rowElement);
    }

    /*
     * Event listener for handling the wheel event.
     * This event is used to scroll the terminal content.
     */
    document.addEventListener('wheel', event => {
        let previousOffset = cursorPosition.verticalOffset;
        // Ensure verticalOffset is between 0 and the content buffer length
        cursorPosition.verticalOffset = Math.min(Math.max(0, cursorPosition.verticalOffset + Math.sign(event.deltaY)), contentBuffer.length - 1);
        if ( previousOffset !== cursorPosition.verticalOffset)
            updateContent();
    })

    window.setTitle('Terminal');

    document
        .addEventListener('keydown', (e) =>
        {
            e.stopImmediatePropagation();

            // If it's a single character, just send it...
            if ( e.key.length === 1 )
            {
                window.terminal.execute(e.key);
            }
            else
            {
                // Check if the pressed key is a special character
                // If so, send its corresponding ANSI code to the shell.
                for ( let key of Object.keys(SpecialCharMap) )
                {
                    if ( key === e.key )
                    {
                        // Sends the provided special character as an ansi code
                        // and executes the 'executes' function, if provided.
                        window.terminal.execute(SpecialCharMap[key].sends);
                        if ( SpecialCharMap[key].executes )
                            SpecialCharMap[key].executes();
                        e.preventDefault();
                    }
                }
            }
        })
    updateContent();
})

/**
 * Function for inserting text into the content buffer and updating the content on
 * the screen. This function inserts the provided content into absolute row and column indices.
 * If out of bounds values are provided, the content array size will grow.
 * @param {string} content The content to insert
 * @param {number} rowIdx The array index of the content buffer. This is an absolute index,
 * not one relative to the screen size. If one wants to place characters at absolute coordinates,
 * one must calculate these values beforehand.
 * @param {number} colIdx The index of the content at the given row. Same as above, this is an absolute index.
 * @param {boolean} replace Whether to replace the text at the provided position or just insert it.
 */
function putString(content, rowIdx, colIdx, replace = true)
{
    // When the index is below 0, add empty elements until normal index 0
    if ( rowIdx < 0 )
    {
        contentBuffer.splice(0, 0, content, ...Array(Math.abs(rowIdx) - 1).fill('\0'))
    }
    // If index is higher than the buffer length, fill the between with empty elements
    else if ( rowIdx > contentBuffer.length )
    {
        contentBuffer.push(...Array(rowIdx - contentBuffer.length - 1).fill('\0'));
    }
    // If none of the other cases are true, regularly insert the text
    else
    {
        if ( contentBuffer[rowIdx] === undefined )
            contentBuffer[rowIdx] = '';
        contentBuffer[rowIdx] = contentBuffer[rowIdx].slice(0, colIdx) + content + contentBuffer[rowIdx].slice(colIdx + (replace ? 0 : content.length));
    }

    // Ensure the size of the content buffer is below maxRows.
    if ( contentBuffer.length > maxRows )
        contentBuffer.splice(0, contentBuffer.length - maxRows);
}

/**
 * Function for updating the content of the terminal window.
 * This function is called whenever the content buffer is updated.
 */
function updateContent()
{
    console.log(cursorPosition, contentBuffer)
    let currentRowElements = terminalContentElement.querySelectorAll('.terminal-row');
    for ( let rowIdx = 0, rowAbsIdx; rowIdx < currentRowElements.length; rowIdx++ )
    {
        rowAbsIdx = rowIdx + cursorPosition.verticalOffset;
        // Prevent out of bounds errors
        if ( rowAbsIdx >= contentBuffer.length || rowAbsIdx < 0 )
            break;
        currentRowElements[rowIdx].innerHTML = contentBuffer[rowAbsIdx];
    }
    // Update the cursor position
    let cursorElement = document.querySelector('.terminal-cursor');
    cursorElement.style.left = `${cursorPosition.x * 8}px`;
    cursorElement.style.top = `${(cursorPosition.y - cursorPosition.verticalOffset) * 16}px`;
}

/**
 * Function for updating the dimensions of the terminal window.
 * This doesn't directly change the size of the window, rather
 * the size of the characters; how many characters can be displayed
 * horizontally and vertically.
 * @param {number} rows The number of rows to display.
 * @param {number} columns The number of columns to display.
 * @private
 */
function __updateDimensions(rows, columns)
{
    // Update the dimensions variable and the inner content.
    Object.assign(dimensions, { columns, rows });
    let currentRowElements = terminalContentElement.querySelectorAll('.terminal-row');

    // Add rows
    if ( currentRowElements.length < rows )
    {
        for ( let i = currentRowElements.length; i < rows; i++ )
        {
            let rowElement = document.createElement('span');
            rowElement.classList.add('terminal-row');
            terminalContentElement.appendChild(rowElement);
        }
    } // Remove rows
    else if ( currentRowElements.length > rows )
    {
        for ( let i = currentRowElements.length; i > rows; i-- )
            terminalContentElement.removeChild(currentRowElements[i]);
    }
    if ( contentBuffer.length < rows )
        contentBuffer.push(...Array(rows - contentBuffer.length).fill('\0'));
}

/**
 * Function for moving the cursor position relative to its current position.
 * @param {number} y By how much to move the cursor on the y-axis. Can be relative or absolute.
 * @param {number} x By how much to move the cursor on the x-axis. Can be relative or absolute.
 * @param absolute Whether to move the cursor position to an absolute location or not
 */
function moveCursor(x, y, absolute = false)
{
    // If the absolute flag is set, move the cursor to the provided location.
    if ( absolute )
    {
        x = Math.max(0, Math.min(x, dimensions.columns));
        y = Math.max(0, Math.min(y, dimensions.rows));
        Object.assign(cursorPosition, { x, y });
    }
    else // Otherwise, move the cursor relative to its current position.
    {
        cursorPosition.x += x;
        cursorPosition.y += y;
        cursorPosition.x = Math.max(0, Math.min(cursorPosition.x, dimensions.columns));
        cursorPosition.y = Math.max(0, Math.min(cursorPosition.y, dimensions.rows));
    }

}

/**
 * Event handler for receiving messages from the shell stream
 */
window['events'].on('terminal:message-received', message =>
{
    let rows = message.split('\n').map(row => {
        return row
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
    })

    // If it's a single message, add it to the screen and move the cursor horizontally
    try
    {
        if ( rows.length === 1 )
        {
            putString(rows[0], cursorPosition.y + cursorPosition.verticalOffset, cursorPosition.x);
            moveCursor(rows[0].length, 0);
        }
        else
        {
            for ( let subMessage of rows )
            {
                putString(subMessage, cursorPosition.y + cursorPosition.verticalOffset, cursorPosition.x);
                moveCursor(0, cursorPosition.y + cursorPosition.verticalOffset + 1, true);
            }
            moveCursor(rows[rows.length - 1].length, 0);
        }
        updateContent();
    }
    catch (error) {
        console.error("Error occurred whilst attempting to insert messages", error);
    }
});

/**
 * Event handler for receiving changes in window dimensions ( cols, rows )
 * This can then be used to resize the font size of the terminal.
 */
window['events'].on('terminal:window-dimensions', (columns, rows) => __updateDimensions(columns, rows));
