/**
 * The input buffer of the terminal.
 * The input buffer is an array of strings, where each string is a
 * line of input. The input buffer is used to store the in- and output
 * of the terminal.
 */
export let contentBuffer: string[] = [];

/**
 * Whether the terminal accepts scrolling functionality.
 * When set to false, the vOffset variable will not be updated.
 */
export let scrollingEnabled: boolean = true;

/**
 * The cursor position in the terminal.
 * The cursor position coordinates are related to the row and column
 * of the terminal. The `vOffset` is the vertical offset of the cursor
 */
export let cursorPosition = { x: 0, y: 0, vOffset: 0 };

/**
 * The maximum size of the buffer of the terminal.
 */
export const maxBufferLength = 1 << 16;

/**
 * The dimensions of the terminal in rows and columns.
 * These are arbitrary sizes, and are related to the dimensions of
 * the window of the terminal.
 */
export let dimensions = { rows: 24, columns: 80 };

/**
 * The dimensions of the terminal window in pixels.
 * These dimensions do not accommodate for retina displays. If one
 * wants to obtain the absolute dimensions, one must multiply these
 * dimensions by the device pixel ratio.
 */
export let windowDimensions = { width: 0, height: 0 };

/**
 * Function for handling the incoming messages of the terminal.
 * This function is called whenever the terminal receives input.
 * The input is then processed and stored in the input buffer,
 * and then displayed on the terminal.
 */
export function handleIncoming(incomingMessage: string)
{
    putString( incomingMessage );
}

/**
 * Function for handling the outgoing messages of the terminal.
 * This function is called whenever the terminal sends output.
 * @param message The message to be sent.
 */
export function handleOutgoing(message: string)
{
    putString( message );
}

/**
 * Function for appending content to the terminal's `contentBuffer`.
 * This method appends one char at the time. Everytime one calls this function
 * with a string longer than 1 character, the function will call itself with
 * each character in the string.
 * @param content The message to be appended to the content buffer.
 */
export function putString(content: string)
{
    // If the function argument is longer than one character,
    // call the function with each character in the string.
    if ( content.length > 1 )
    {
        for ( let i = 0; i < content.length; i++ )
            putString( content[ i ] );
        return;
    }

    let currentLine = contentBuffer[ cursorPosition.y ];

    // If the current line has no content,
    // append the provided parameter and stop.
    if ( !currentLine )
    {
        contentBuffer[ cursorPosition.y ] = content;
        cursorPosition.x++;
        return;
    }

    // If the function parameter is a newline character,
    // move to the next line.
    if ( content === '\n' )
    {
        cursorPosition.y++;
        return;
    }

    // If the function parameter is a carriage return character,
    // move to the beginning of the line.
    if ( content === '\r' )
    {
        cursorPosition.x = 0;
        return;
    }

    // If the horizontal cursor position is outside the current line,
    // add spaces to the line until the cursor position is reached.
    // If the cursor position is outside the terminal dimensions,
    // move to the next line.
    if ( cursorPosition.x >= currentLine.length )
    {

        // If the horizontal cursor position is outside the terminal dimensions,
        // move to the next line.
        if ( cursorPosition.x >= dimensions.columns )
        {
            cursorPosition.x = 1;
            cursorPosition.y++;
            // Update the buffer's next line
            contentBuffer[ cursorPosition.y ] = !contentBuffer[ cursorPosition.y ] ? content :
                content + contentBuffer[ cursorPosition.y ].substring( 1 );
        }
        else
        {
            // If the horizontal cursor position is outside the current line,
            // add spaces to the line until the cursor position is reached.
            if ( cursorPosition.x - currentLine.length > 0)
            {
                contentBuffer[ cursorPosition.y ] = currentLine + ' '.repeat( cursorPosition.x - currentLine.length ) + content;
                cursorPosition.x += cursorPosition.x - currentLine.length + 1;
            }
            else
            {
                contentBuffer[ cursorPosition.y ] = currentLine + content;
                cursorPosition.x++;
            }
        }
        return;
    }

    // Ensure the content buffer has enough space
    if ( cursorPosition.y >= contentBuffer.length )
        contentBuffer.push( ...Array( cursorPosition.y - contentBuffer.length + 1 ).fill( '' ) );

    contentBuffer [ cursorPosition.y ] = currentLine.substring( 0, cursorPosition.x ) + content +
        currentLine.substring( cursorPosition.x + 1 );

    cursorPosition.x++;
}

/**
 * Function for setting the cursor position in the terminal.
 * The cursor position is set by the row and column of the terminal.
 * @param x The column of the terminal.
 * @param y The row of the terminal.
 */
export function setCursorPosition(x: number, y: number)
{
    cursorPosition.x = x;
    cursorPosition.y = y;
}

/**
 * Function for translating the cursor position in the terminal.
 * The cursor position is translated by the given x and y values.
 * @param x The x value to be added to the cursor position.
 * @param y The y value to be added to the cursor position.
 */
export function translateCursorPosition(x: number, y: number)
{
    cursorPosition.x += x;
    cursorPosition.y += y;
}

/**
 * Function for updating the vertical offset of the cursor.
 * The vertical offset is the offset of the cursor in the terminal from
 * the top of the terminal. This is used for scrolling functionality.
 * @param offset What to set the vertical offset to.
 */
export function setVerticalOffset(offset: number): void
{
    cursorPosition.vOffset = offset;
}

/**
 * Function for updating the vertical offset of the cursor.
 * Similar to the `setVerticalOffset` function, but this function
 * adds the offset to the current vertical offset.
 * @param offset What to add to the vertical offset.
 */
export function translateVerticalOffset(offset: number): void
{
    cursorPosition.vOffset += offset;
}

/**
 * Special keys that can be used in the terminal.
 * These keys are used for special functionality in the terminal.
 * The keys are mapped to their respective escape sequences and
 * functions.
 */
export const specialKeys = {
    ArrowUp: {
        sends: '\x1b[A',
        executes: _ => translateCursorPosition( 0, -1 )
    },
    ArrowDown: {
        sends: '\x1b[B',
        executes: _ => translateCursorPosition( 0, 1 )
    },
    ArrowRight: {
        sends: '\x1b[C',
        executes: _ => translateCursorPosition( 1, 0 )
    },
    ArrowLeft: {
        sends: '\x1b[D',
        executes: _ => translateCursorPosition( -1, 0 )
    },
    Backspace: {
        sends: '\x7f',
        executes: _ =>
        {
            translateCursorPosition( -1, 0 );
            putString( '' );
        }
    },
    Enter: {
        sends: '\r\n',
        executes: _ => translateCursorPosition( 0, 1 )
    },
    Tab: {
        sends: '\t',
        executes: _ => putString( '    ' )
    },
    Escape: {
        sends: '\x1b',
    },
    Control: {
        sends: '\x1b',
    }

}