/** - - - - - - - - - - - - - - - - - - - - - - - **
 | Here lies the implementation of inner terminal. |
 ** - - - - - - - - - - - - - - - - - - - - - - - **/

/**
 * History of the terminal commands.
 */
let history = [];
let historyIndex = 0;

let terminalContent;

document.addEventListener('DOMContentLoaded', _=> {

    terminalContent = document.querySelector('.terminal-content');

    window.setTitle('Terminal');

    document
        .getElementById('terminal-input')
        .addEventListener('keydown', (e) => {
        e.stopImmediatePropagation();

        switch (e.key) {
            case 'Enter':
                // Check whether there's actual input.
                if (e.target.value.trim().length < 1)
                    return;
                history.splice(historyIndex, 0, e.target.value);
                historyIndex = history.length;
                window.terminal.execute(e.target.value);
                e.target.value = '';
                break;
            case 'ArrowUp':
                if (historyIndex > 0)
                    historyIndex--;

                e.target.value = history[historyIndex] || '';
                e.preventDefault();
                break;
            case 'ArrowDown':
                if (historyIndex < history.length - 1)
                    historyIndex++;

                e.target.value = history[historyIndex] || '';
                e.preventDefault();
                break;
            default:
                if (e.ctrlKey) {
                    window.terminal.execute(`\x1b${e.target.value}`)
                    return;
                }
                break;
        }
    })
})


/**
 * Function for printing message(s) to the virtual terminal.
 * @param {string} message The message(s) to display. Can be either a single string or an array
 */
function println(message) {

    // Clear screen ANSI code.
    terminalContent.innerHTML += message;
    terminalContent.scrollTop = terminalContent.scrollHeight;
}
window.events.on('message-received', message => println(message))
