
let fileTransferElement;

let terminalDir = '~';

document.addEventListener('DOMContentLoaded',  () => {
    // Load the files from the current directory
    addLoadingSpinner(document.querySelector('.process-loading'));
    document.getElementById('back-main').onclick = () => window.location.href = '../index.html'

    fileTransferElement = document.querySelector('.file-transfer-progress');

    let fileInfoResize = document.querySelector('.file-information-resize');
    let fileInfoContainer = document.querySelector('.file-information');

    fileInfoResize.addEventListener('mousedown', (e) => fileInfoResize.classList.add('active'));
    document.addEventListener('mouseup', (e) => fileInfoResize.classList.remove('active'));
    document.addEventListener('mousemove', (e) => {
        if (!fileInfoResize.classList.contains('active'))
            return;
        fileInfoContainer.style.width = `calc(100vw - ${e.clientX}px)`;
    });

    busy(true);
    window.ssh.currentDirectory()
        .then(dir => window.ssh.listFiles(dir)
            .then(result => {
                currentDir = terminalDir = dir;
                storeFiles(result, dir);
                loadFileViewer();
            })
            .catch(_ => console.log(_))
            .finally(_ => busy(false))
        )
        .catch(_ => {
            console.log(_);
            window.location.href = '../index.html'
        }) // Redirect to the main page if the user is not connected
        .finally(_ => busy(false));

    let terminalInput = document.getElementById('terminal-input');

    document.querySelector('.terminal-toggle-view')
        .addEventListener('dblclick', (event) => {
            document.getElementById('terminal').classList.toggle('hidden');
            event.preventDefault();
            event.stopImmediatePropagation();
        })

    // When user presses enter, simulate a click on the send button
    terminalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            terminalPrint('> ' + terminalInput.value);
            window.terminal.execute(currentDir, terminalInput.value)
                .then(result => terminalPrint(result))
                .catch(error => terminalPrint(error, '#ff0000'));
            terminalInput.value = '';
        }
    });
})

/**
 * Prints a message to the terminal console.
 * @param {string[] | string} content The message to print.
 * @param {string} color The color of the message. Default is white
 */
function terminalPrint(content, color= '#ffffff') {
    let contentBox = document.querySelector('.terminal-content');
    if (!Array.isArray(content))
        content = content.split('\n');
    content.forEach(line => {
        contentBox.innerHTML += `<div class="terminal-output" style="color: ${color}">${line}</div>`;
    })
}

/**
 * Event handling of file transfer progress.
 * This updates the progress bar in the file viewer accordingly.
 */
window.events.on('file-transfer-progress', (status) => {
    status.progress = Math.min(Math.max(0, status.progress), 100)
    fileTransferElement.style.setProperty('--progress', '' + status.progress)
    fileTransferElement.style.visibility = status.finished ? 'hidden' : 'visible';
});