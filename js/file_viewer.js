$(document).ready(() => {
    addLoadingSpinner($('.process-loading')[0]);
    $('#back-main').on('click', () => window.location.href = '../index.html');

    let terminalDir = '~';

    // Resizing of the file information section
    let fileInfoResize = $('.file-information-resize');
    fileInfoResize.on('mousedown', _ => fileInfoResize.addClass('active'));
    $(document).on('mouseup', _ => fileInfoResize.removeClass('active'));
    $(document).on('mousemove', (e) => {
        if (fileInfoResize.hasClass('active'))
            $('.file-information').css('width', `calc(100vw - ${e.clientX}px)`);
    })

    // Hiding and showing the terminal console
    $('.terminal-toggle-view').on('dblclick', (event) => {
        $('#terminal').toggleClass('hidden');
        event.preventDefault();
        event.stopImmediatePropagation();
    })

    // When user presses enter, send the command
    $('#terminal-input').on('keydown', (e) => {
        // Check if the user pressed the Enter key and the input is not empty
        if (e.key === 'Enter' && e.target.value.trim() !== '') {
            terminalPrint('> ' + e.target.value);
            window.terminal.execute(terminalDir, e.target.value)
                .then(result => terminalPrint(result))
                .catch(error => terminalPrint(error, '#ff0000'));
            e.target.value = '';
        }
    })

    let contentBox = $('.terminal-content');

    function terminalPrint(message, color = '#ffffff') {
        if (!Array.isArray(message))
            message = message.split('\n');
        message.forEach(line => {
            contentBox.append(`<div class="terminal-output" style="color: ${color}">${line}</div>`);
        })
    }
    busy(true);
    window.ssh.startingDir()
        .then(res => {
            currentDir = terminalDir = res.path;
            storeFiles(res.files, res.path);
            loadFileViewer();
        })
        .catch(_ => {
            console.log(_);
            //window.location.href = '../index.html'
        })
        .finally(_ => {busy(false)});

    setInterval(checkFsDifferences, 3000);
});

/**
 * Periodically checks the differences between the local and remote file system.
 * If there's any changes, the file viewer will be updated accordingly.
 */
async function checkFsDifferences() {
    // Check if there's an active connection, if not, don't proceed.
    if (window.ssh === undefined || currentDir === undefined || !(await window.ssh.connected()))
        return;

    //
    let cachedFiles = getFiles(currentDir);
    window.ssh.listFiles(currentDir)
        .then(result => result.split('\n'))
        .then(serverFiles => {
            // Compare files, if there's any difference, update the file viewer
            if (cachedFiles.length !== serverFiles.length || cachedFiles.some((file, i) => file !== serverFiles[i])) {
                storeFiles(serverFiles, currentDir, true);
                loadFileViewer();
                console.log('Received incoming changes');
            }
        }) // TODO: Handle errors
        .catch(_ => console.log(_));
}

/**
 * Event handling of file transfer progress.
 * This updates the progress bar in the file viewer accordingly.
 */
window.events.on('file-transfer-progress', (status) => {
    status.progress = Math.min(Math.max(0, status.progress), 100)
    let fileTransferElement = $('.file-transfer-progress');
    fileTransferElement.css('--progress', status.progress + '%')
    fileTransferElement.css('visibility', status.finished ? 'hidden' : 'visible');
});