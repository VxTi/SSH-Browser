/** - - - - - - - - - - - - - - - - - - - - - - - **
 | Here lies the implementation of inner terminal. |
 ** - - - - - - - - - - - - - - - - - - - - - - - **/

const logging = {}

/**
 * History of the terminal commands.
 */
let terminalHistory = [];
let terminalHistoryIndex = 0;

let terminalContent;
let terminalDir = '~';

$(document).ready(() => {

    terminalContent = document.querySelector('.terminal-content');

    $('#terminal-input').on('keydown', (e) => {
        e.stopImmediatePropagation();

        switch (e.key) {
            case 'Enter':
                // Check whether there's actual input.
                if (e.target.value.trim().length < 1)
                    return;
                terminalHistory.push(e.target.value);
                terminalHistoryIndex = terminalHistory.length - 1;
                window.terminal.execute(terminalDir, e.target.value);
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
                    logging && window.logger.log("Sending escape key");
                    window.terminal.execute(terminalDir, `\x1b${e.target.value}`)
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
    console.log("Received");
    if (!Array.isArray(messages))
        messages = messages.split('\n');

    messages.forEach(messageContent => {
        let messageElement = document.createElement('div');
        messageElement.innerText = messageContent;
        messageElement.classList.add('terminal-output')
        if (typeof color !== 'undefined')
            messageElement.style.color = color;
        terminalContent?.appendChild(messageElement);
    })
    terminalContent.scrollTop = terminalContent.scrollHeight;
}
window.events.on('message-received', message => println(message))
