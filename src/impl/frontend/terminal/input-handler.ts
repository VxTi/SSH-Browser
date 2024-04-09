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
export const maxBufferLength = 4096;

/**
 * The dimensions of the terminal in rows and columns.
 * These are arbitrary sizes, and are related to the dimensions of
 * the window of the terminal.
 */
export let dimensions = { rows: 0, columns: 0 };

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
    putString(incomingMessage);
}

/**
 * Function for handling the outgoing messages of the terminal.
 * This function is called whenever the terminal sends output.
 * @param message The message to be sent.
 */
export function handleOutgoing(message: string)
{
    putString(message);
}

/**
 * Function for appending a string to the content buffer.
 * This appends the string to the content buffer at the
 * current cursor position. The cursor position is not
 * updated in this function. This is handled in the `handleIncoming`
 * and `handleOutgoing` functions.
 * @param message The message to be appended to the content buffer.
 */
function putString(message: string)
{
    if ( contentBuffer.length >= maxBufferLength )
        contentBuffer.splice(0, contentBuffer.length - maxBufferLength);

    let lines = message.split('\n');

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
 * Default exports ( Everything )
 */
export default {
    contentBuffer,
    scrollingEnabled,
    cursorPosition,
    maxBufferLength,
    dimensions,
    windowDimensions,
    translateCursorPosition,
    handleIncoming,
    handleOutgoing,
    setCursorPosition,
    setVerticalOffset,
}


