/** - - - - - - - - - - - - - - - - - - - - - - - **
 | Here lies the implementation of inner terminal. |
 ** - - - - - - - - - - - - - - - - - - - - - - - **/

/**
 * TODO - Add ANSI escape code support.
 */

/**
 * History of the terminal commands.
 */
let terminalHistory = [];
let terminalHistoryIndex = 0;

const minWidth = '20vw';
const minHeight = '100px'
const maxWidth = '80vw';
const maxHeight = '80vh';

let terminalContent;

$(document).ready(() => {

    terminalContent = document.querySelector('.terminal-content');

    // Implementation of resizing of the terminal.
    $('.terminal-resize-horizontal')
        .on('mousedown', e => e.target.classList.add('rs-h'))
        .on('dblclick', _ => {
            $('.terminal').toggleClass('hidden')
        })
    $('.terminal-resize-vertical')
        .on('mousedown', e => e.target.classList.add('rs-v'))
        .on('dblclick', _ => {
            $('.terminal').toggleClass('hidden')
        })

    $(document).on('mousemove', e => {
        if ($('.rs-h').length > 0)
            $('.terminal').css('--width', `calc(min(max(${minWidth}, ${e.clientX}px), ${maxWidth}))`);

        if ($('.rs-v').length > 0)
            $('.terminal').css('--height', `calc(min(max(${minHeight}, ${window.innerHeight - e.clientY}px), ${maxHeight}))`);
    })

    $(document).on('mouseup', e => $('.rs-h, .rs-v').removeClass('rs-h rs-v'))

    $('#terminal-input').on('keydown', (e) => {
        e.stopImmediatePropagation();

        switch (e.key) {
            case 'Enter':
                // Check whether there's actual input.
                if (e.target.value.trim().length < 1)
                    return;
                terminalHistory.push(e.target.value);
                terminalHistoryIndex = terminalHistory.length - 1;
                window.terminal.execute(e.target.value);
                e.target.value = '';
                break;
            case 'ArrowUp':
                e.target.value = terminalHistory[Math.max(0, --terminalHistoryIndex)] || '';
                break;
            case 'ArrowDown':
                e.target.value = terminalHistory[Math.min(terminalHistory.length - 1, ++terminalHistoryIndex)] || '';
                break;
            default:
                if (e.ctrlKey) {
                    window.terminal.execute(`\x1b${e.target.value}`)
                    return;
                }
                terminalHistoryIndex = terminalHistory.length - 1;
        }
    })
})


/**
 * Function for printing message(s) to the virtual terminal.
 * @param {string | string[]} messages The message(s) to display. Can be either a single string or an array
 * @param {string} color The color to give the message. Default is white.
 */
function println(messages, color = undefined) {
    if (!Array.isArray(messages))
        messages = messages.split('\n');

    messages.forEach(messageContent => {
        let messageElement = document.createElement('div');
        // TODO: Add support for ANSI escape codes.

        messageElement.innerHTML = messageContent;

        messageElement.classList.add('terminal-output')
        if (typeof color !== 'undefined')
            messageElement.style.color = color;
        terminalContent?.appendChild(messageElement);
    })
    terminalContent.scrollTop = terminalContent.scrollHeight;
}
window.events.on('message-received', message => println(message))
