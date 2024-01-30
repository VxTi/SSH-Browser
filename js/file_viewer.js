document.addEventListener('DOMContentLoaded',  () => {
    // Load the files from the current directory
    addLoadingSpinner(document.querySelector('.process-loading'));
    document.getElementById('back-main').onclick = () => window.location.href = '../index.html'

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
                console.log(`Dir: [${dir}] Files[${result}]`);
                current_directory = dir;
                storeFiles(result, dir);
                loadFileViewer();
            })
            .finally(_ => busy(false))
        )
        .catch(_ => window.location.href = '../index.html')
        .finally(_ => busy(false));
})