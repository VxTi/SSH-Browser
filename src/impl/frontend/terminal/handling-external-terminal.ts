/** - - - - - - - - - - - - - - - - - - - - - - - **
 | Here lies the implementation of inner terminal. |
 ** - - - - - - - - - - - - - - - - - - - - - - - **/

import * as term from './input-handler'

/**
 * The element which holds the terminal text.
 */
let terminalContentElement: Element;


document.addEventListener( 'DOMContentLoaded', _ =>
{

    terminalContentElement = document.querySelector( '.terminal-content' );

    window[ 'setTitle' ]( `Terminal ${term.dimensions.columns}x${term.dimensions.rows}` );

    // Add all rows
    for ( let i = 0; i < term.dimensions.rows; i++ )
    {
        let rowElement = document.createElement( 'span' );
        rowElement.classList.add( 'terminal-row' );
        terminalContentElement.appendChild( rowElement );
    }

    /*
     * Event listener for handling the wheel event.
     * This event is used to scroll the terminal content.
     */
    document.addEventListener( 'wheel', event =>
    {
        if ( !term.scrollingEnabled )
            return;
        let previousOffset = term.cursorPosition.vOffset;
        // Ensure verticalOffset is between 0 and the content buffer length
        term.cursorPosition.vOffset = Math.min( Math.max( 0, term.cursorPosition.vOffset + Math.sign( event.deltaY ) ), term.contentBuffer.length - 1 );
        if ( previousOffset !== term.cursorPosition.vOffset )
            updateContent();
    } )

    document
        .addEventListener( 'keydown', (e) =>
        {
            e.stopImmediatePropagation();

            // If it's a single character, just send it...
            if ( e.key.length === 1 )
            {
                window[ 'app' ][ 'terminal' ].execute( e.key );
            }
            else
            {
                // Check if the pressed key is a special character
                // If so, send its corresponding ANSI code to the shell.
                Object.keys( term.specialKeys )
                    .forEach( key => {
                        if ( key === e.key )
                        {
                            window[ 'app' ][ 'terminal' ].execute( term.specialKeys[ key ].sends );
                            if ( term.specialKeys[ key ].executes )
                                term.specialKeys[ key ].executes();
                            e.preventDefault();
                        }
                    });
            }
        } )
    updateContent();
} )


/**
 * Function for updating the content of the terminal window.
 * This function is called whenever the content buffer is updated.
 */
function updateContent()
{
    console.log(term.contentBuffer)
    let currentRowElements = terminalContentElement.querySelectorAll( '.terminal-row' );

    // Set the number of visible rows to the amount
    // of rows in the terminal dimensions.
    if ( currentRowElements.length !== term.dimensions.rows )
    {
        if ( currentRowElements.length < term.dimensions.rows )
        {
            for ( let i = currentRowElements.length; i < term.dimensions.rows; i++ )
            {
                let rowElement = document.createElement( 'span' );
                rowElement.classList.add( 'terminal-row' );
                terminalContentElement.appendChild( rowElement );
            }
        }
        else
        {
            for ( let i = currentRowElements.length; i > term.dimensions.rows; i-- )
            {
                terminalContentElement.removeChild( currentRowElements[ i - 1 ] );
            }
        }
        currentRowElements = terminalContentElement.querySelectorAll( '.terminal-row' );
    }

    for ( let rowIdx = 0, rowAbsIdx = 0; rowIdx < currentRowElements.length; rowIdx++ )
    {
        rowAbsIdx = rowIdx + term.cursorPosition.vOffset;
        // Prevent out of bounds errors
        if ( rowAbsIdx >= term.contentBuffer.length || rowAbsIdx < 0 )
        {
            currentRowElements[ rowIdx ].innerHTML = '';
        }
        else currentRowElements[ rowIdx ].innerHTML = term.contentBuffer[ rowAbsIdx ];
    }
    // Update the cursor position
    let cursorElement = document.querySelector( '.terminal-cursor' ) as HTMLElement;
    cursorElement.style.left = `${ term.cursorPosition.x * 8 }px`;
    cursorElement.style.top = `${ (term.cursorPosition.y - term.cursorPosition.vOffset) * 16 }px`;
}


/**
 * Event handler for receiving messages from the shell stream
 */
window[ 'events' ].on( 'terminal:message-received', (message: string) =>
{
    try
    {
        // Prevent
        message = message
            .replaceAll( '<', '&lt;' )
            .replaceAll( '>', '&gt;' )

        term.handleIncoming( message );
        updateContent();
    } catch ( error ) {
        console.error( 'Error occurred with message', message, error );
    }
} );

window[ 'events' ].on('window:onresize', (width: number, height: number) => {
    let [ cols, rows ] = [
        term.columnWidth * Math.floor(width / term.columnWidth),
        term.rowHeight * Math.floor(height / term.rowHeight)
    ]
    term.dimensions.columns = cols / term.columnWidth;
    term.dimensions.rows = rows / term.rowHeight;
    console.log(cols, rows, term.dimensions.columns, term.dimensions.rows)
    window[ 'app' ][ 'window' ].resize(cols, rows);
    window[ 'setTitle' ]( `Terminal ${term.dimensions.columns}x${term.dimensions.rows}` );
});