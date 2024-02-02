
let fileTransferElement;

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
                currentDir = dir;
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

    document.getElementById('terminal-send').addEventListener('click', () => {
        let inputBox = document.getElementById('terminal-input');
        terminalPrint(inputBox.value);
        window.terminal.execute(inputBox.value)
            .then(result => terminalPrint(result));
        inputBox.value = '';


    });
})

function terminalPrint(content) {
    let contentBox = document.querySelector('.terminal-content');
    let newContent = document.createElement('div');
    newContent.innerText = content;
    newContent.classList.add('terminal-output');
    contentBox.appendChild(newContent);
}

window.events.on('file-transfer-progress', (status) => {
    console.log(status)
    status.progress = Math.min(Math.max(0, status.progress), 100)
    fileTransferElement.style.setProperty('--progress', '' + status.progress)
    fileTransferElement.style.visibility = status.finished ? 'hidden' : 'visible';
});