
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
                current_directory = dir;
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
})

window.events.on('file-transfer-progress', (status) => {
    console.log(status)
    status.progress = Math.min(Math.max(0, status.progress), 100)
    fileTransferElement.style.setProperty('--progress', '' + status.progress)
    fileTransferElement.style.visibility = status.finished ? 'hidden' : 'visible';
});