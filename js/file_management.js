let busy = (state) => $('.process-loading').css('visibility', state ? 'visible' : 'hidden');

let currentUser = undefined

/**
 * History of user navigation
 */
let navigationHistory = [];
let navigationHistoryIndex = 0;

$(document).ready(() => {
    addLoadingSpinner($('.process-loading')[0]);
    $('#back-main').on('click', () => window.location.href = '../index.html');

    // Resizing of the file information section
    $('.file-information-resize').on('dblclick', _ => $('.file-information').toggleClass('hidden'))

    // Hiding and showing the terminal console
    $('.terminal-toggle-view').on('dblclick', (event) => {
        $('#terminal').toggleClass('hidden');
        event.preventDefault();
        event.stopImmediatePropagation();
    })

    busy(true);
    window.ssh.startingDir()
        .then(res => {
            currentDir = terminalDir = res.path;
            storeFiles(res.files, res.path);
            loadFileViewer();
        })
        .catch(_ => {
            window.logger.log(_);
            window.location.href = '../index.html'
        })
        .finally(_ => {busy(false)});

    setInterval(checkFsDifferences, 3000);

    // Context menu functionality
    $('#ctx-download').on('click', () => {
        let selected = document.querySelector('.file.selected');
        if (selected)
            window.ssh.downloadFile(selected.dataset.path, selected.dataset.name);
    })
    // When the user clicks on the screen outside a file element, hide the context menu.
    $(document).on('click', _ => $('.context-menu').removeClass('active'));

    // When a user double-clicks on the document, we deselect all files and hide the file information.
    $(document).on('dblclick', () => {
        $('.file-information').addClass('hidden');
        $('.file.selected').removeClass('selected');
    })

    /** Context menu - Right-clicking*/
    $(document).on('contextmenu', async (event) => {
        if (!document.hasFocus())
            return;
        event.preventDefault();
        event.stopImmediatePropagation();

        // Select potential file
        let target = event.target.parentElement || event.target;
        let isFile = target.classList.contains('file');
        let hasClipboard = await navigator.clipboard.readText().then(text => text.length > 0);

        // Which items are enabled in the context menu
        /** @type {HTMLElement[]} */
        let enabled = [];

        if (isFile) {
            target.classList.add('selected');
            enabled.push(
                ...['copy', 'cut', 'delete', 'rename', 'download']
                    .map(e => document.getElementById('ctx-' + e))
            );
        }

        // If there's something in the clipboard, we enable the 'paste' action.
        if (hasClipboard)
            enabled.push(document.getElementById('ctx-paste'));

        // Disable all context actions first.
        $('.context-menu-item').addClass('disabled');


        // If the target has a 'context-menu' dataset property, we enable the items specified in the property.
        // First, check whether it has a 'context-menu' dataset property.
        if (target.dataset.hasOwnProperty('contextMenu')) {
            let items = target.dataset.contextMenu.split(' ');
            items.forEach(ctxMenuItem => {
                let element = document.getElementById('ctx-' + ctxMenuItem.trim());

                if (element)
                    enabled.push(element);
            })
        }

        enabled.forEach(e => e.classList.remove('disabled'));

        let menu = document.querySelector('.context-menu');
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';
        if (enabled.length > 0)
            menu.classList.add('active');
    });
});

/**
 * Loading in the functionality of the file viewer.
 * All files that are loaded are cached in the 'fileCache' object.
 * These are then converted into elements visible on the screen.
 * All previously visible files will be removed upon calling this function.
 */
function loadFileViewer() {

    if (currentUser === undefined)
        currentUser = window.ssh.sessions.currentSession().username;

    // If for whatever reason currentDir is not defined, return to home menu.
    if (currentDir === undefined) {
        window.location.href = '../index.html';
        return;
    }

    // Remove all previous segments from previous queries

    $('.path-separator, .path-arrow, .path-separator, .file').remove();

    let pathContainer = document.querySelector('.path-section');

    let pathSegments = currentDir.split('/') || [''];

    // Add all the path segments to the path container
    // These are just directories
    for (let i = 0; i < pathSegments.length; i++) {
        let seg = pathSegments[i];

        /** Path segment element on the bottom of the page **/
        let directory = document.createElement('div');
        directory.classList.add('path-separator');

        // We'd like to set the 'dataset.path' to the current path.
        // If we're on the root folder, e.g. currentDir == '/', pathSegments = ['', ''].
        // We want to turn the path into just '/'.
        directory.dataset.path = pathSegments.slice(0, i + 1).join('/').trim() || '/';
        directory.dataset.name = seg;
        directory.innerText = seg;
        console.log(seg);

        directory.addEventListener('click', () => navigateTo(directory.dataset.path))

        /** Directory separator arrow **/
        let arrow = document.createElement('div');
        arrow.classList.add('path-arrow');

        pathContainer.appendChild(arrow);
        pathContainer.appendChild(directory);
    }

    // Clear all previously shown files and show all
    // files in the current working directory.
    loadFileElements(currentDir, true);

    // Add file filtering functionality
    let filter = $('#file-filter');
    filter.val(''); // reset previous input
    filter.blur(); // remove focus from the input
    filter.on('input', () => {
        $('.file').each((i, file) => {
            file = $(file);
            file.toggleClass('hidden', file.data('name').indexOf(filter.val()) < 0);
        })
    });

    /**
     * Functionality for the 'refresh' button in the action bar
     */
    document.getElementById('action-refresh')
        .onclick = () => {
        busy(true);
        window.ssh.listFiles(currentDir)
            .then(result => {
                storeFiles(result, currentDir, true);
                loadFileViewer();
            }).finally(_ => {busy(false)});
    };

    /**
     * Functionality for the 'add file' button in the action bar
     */
    document.getElementById('action-add-file')
        .onclick = () => {

            busy(true);
            window.ssh.selectFiles()
                .then(files => {
                    if (files.length < 1)
                        return;
                    window.ssh.uploadFiles(currentDir, files) // TODO: Error handling
                        .finally(_ => {busy(false)});
                })
    };

    /**
     * Functionality for the 'delete file' button in the action bar
     */
    document.getElementById('action-delete-file')
        .onclick = () => {
        let selected = [...document.querySelectorAll('.file.selected')];
        if (selected.length === 0)
            return;

        busy(true);

        // Remove all selected files from the server
        Promise.all(selected.map(file => window.ssh.deleteFile(file.dataset.path, file.dataset.name)))
            .then(_ => {
                // Remove previously selected files from the file viewer
                selected.forEach(e => e.remove());

                // Retrieve files and filter out the deleted ones.
                let files = getFiles(currentDir);
                files.forEach((file, i) => {
                    if (selected.find(e => e.dataset.name === file.name))
                        files.splice(i, 1);
                });

                // Update the file map
                fileCache[currentDir] = files;

            })
            .finally(_ => {busy(false)});
    };


    /** Functionality for the 'home' button */
    document.getElementById('action-home').onclick = () => {
        busy(true);
        window.ssh.startingDir()
            .then(res => {
                currentDir = res.path;
                storeFiles(res.files, currentDir);
                loadFileViewer();
            })
            .finally(_ => {busy(false)});
    };

    /**
     * Add keyboard functionality.
     * Example, moving through files with arrow keys,
     * Deleting files, etc.
     */
    document.addEventListener('keydown', (e) => {
        let selected = document.querySelector('.file.selected');
        if (!selected)
            return;

        let next = null;

        if (e.key === 'ArrowLeft')
            next = selected.previousElementSibling;
        else if (e.key === 'ArrowRight')
            next = selected.nextElementSibling;
        else if (e.key === 'Escape')
            document.querySelectorAll('.file.selected').forEach(e => e.classList.remove('selected'));

        if (next) {
            if (!e.shiftKey) selected.classList.remove('selected');
            next.classList.add('selected');
            let files = [];
            document.querySelectorAll('.file.selected').forEach(e => files.push(e.dataset.name))
            selectFiles(files);
        }
    });
    // Add drag and drop functionality
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
    });

    // Drag 'n drop files to the file viewer
    // This will upload the files to the server.
    document.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        /** @type {string[]} */
        let pathArr = [];
        for (const f of event.dataTransfer.files)
            pathArr.push(f.path);

        busy(true);
        window.ssh.uploadFiles(currentDir, pathArr)
            .then(_ => {
                // get current files in currentDir, map paths to file objects and add to fileCache
                getFiles(currentDir).push(...pathArr.map(p => new File(p.substring(p.lastIndexOf('/') + 1), p)));
                loadFileElements(currentDir, true);
            })
            .finally(_ => busy(false));
    });
}

/**
 * Method for loading all files in the currently selected directory.
 * This method converts the files in 'fileCache[currentDir]' into elements.
 */
function loadFileElements(directory = currentDir, clearOld = true) {

    // remove all old files if
    if (clearOld) $('.file').remove();

    let fileContainer = document.querySelector('.file-container');

    let files = getFiles(directory);

    // Add all files to the file container
    files.forEach(file => fileContainer.appendChild(createFileElement(file)));
}

/**
 * Retrieves the appropriate file icon for the given file, as a string (css class)
 * @param {File | string} file
 * @returns {string} The appropriate file icon class for CSS.
 */
function getFileThumbnail(file) {
    if (file instanceof File)
        file = file.name;
    let executables = ['exe', 'sh', 'bat', 'dylib', 'so', 'dll'];
    let acceptedExtensions = ['css', 'html', 'js', 'json', 'txt', 'md'];
    let isExecutable = executables.indexOf(file.substring(file.lastIndexOf('.') + 1)) >= 0;
    return (file.endsWith('/') || file.indexOf('.') < 0) ? 'file-directory' : isExecutable ? 'file-executable' :
        acceptedExtensions.indexOf(file.substring(file.lastIndexOf('.') + 1)) >= 0 ? 'file-' + file.substring(file.lastIndexOf('.') + 1) : 'file-ordinary';

}

/**
 * Method for navigating to a different directory.
 * @param {string | File} target The directory to navigate to.
 */
function navigateTo(target) {
    if (target instanceof File) {
        // Convert to viable path
        target = target.path + (target.directory ? '/' + target.name : '')
    }
    console.log('Attempting to navigate to', target);

    // If we're already on there, don't proceed.
    if (target === currentDir)
        return;

    busy(true);
    window.ssh
        .listFiles(target) // Retrieve files from selected directory
        .then(result => {
            navigationHistory.push(currentDir);
            storeFiles(result, target);
            currentDir = target;
            loadFileViewer(); // reload the file viewer
        })
        .catch(_ => console.log('Error occurred whilst attempting to navigate', _))
        .finally(_ => {busy(false)});
}

/**
 * Method for creating a file element.
 * @param {File} file The file object to create an element for
 * @returns {HTMLDivElement} The file element created
 */
function createFileElement(file) {
    // Main file element. Here we add all functionality for whenever a user interacts with it.
    // This can be dragging, opening, moving, etc.

    let executables = ['exe', 'sh', 'bat', 'dylib', 'so', 'dll'];
    let isExecutable = executables.indexOf(file.name.substring(file.name.lastIndexOf('.') + 1)) >= 0;

    let fileElement = document.createElement('div');
    fileElement.classList.add('file', 'r-icons', file.directory ? 'directory' : 'ordinary');
    fileElement.dataset.path = file.path;
    fileElement.dataset.name = file.name;
    fileElement.title = file.name;
    fileElement.dataset.contextMenu = `${file.directory ? 'paste' : ''} ${isExecutable ? 'execute' : ''}`
    fileElement.draggable = true;
    file.reference(fileElement);

    let fileIcon = document.createElement('div');

    fileIcon.classList.add('file-icon', getFileThumbnail(file));
    fileElement.appendChild(fileIcon);

    // Add the file name to the file element
    let fileTitle = document.createElement('span');
    fileTitle.classList.add('file-name');
    fileTitle.innerHTML = formatFileName(file.name)  ;
    fileElement.appendChild(fileTitle);

    /** File interact functionality **/

    // When one double-clicks on a file, we open it.
    fileElement.addEventListener('dblclick', _ => navigateTo(file));

    // When one clicks on a file, we select it.
    // If we're in column view, we open the directory.
    fileElement.addEventListener('click',  async (event) => {

        // Deselect all other files
        $('.file').removeClass('selected');
        $('.context-menu').removeClass('active');

        fileElement.classList.add('selected');
        await file.loadInfo(true); // Reload file info to show in the file information section
        selectFiles([file.name], file.path);

        // Prevent further propagation of the event.
        event.preventDefault();
        event.stopImmediatePropagation();
    })
    return fileElement;
}

/**
 * Function for selecting a file
 * @param {string} directory The directory in which the file resides.
 * @param {string[]} files The file(s) to select, separated by a newline.
 * This also shows all information in the 'file-information' section.
 */
function selectFiles(files, directory = currentDir) {

    $('.file-information').toggleClass('hidden', files.length <= 0);

    if (files.length === 0)
        return;

    if (files.length > 1) {
        // TODO: Add implementation for multiple files
    } else { // Single file

        let preview = document.querySelector('.file-info-preview');

        // TODO: Fix this
        // Remove all previous classes and add the correct one
        preview.classList.forEach(c => preview.classList.remove(c));
        preview.classList.add('file-info-preview');
        preview.classList.add(getFileThumbnail(files[0]));

        (async () => {
            // If there's only one file, we can show all information about it.
            let file = getFile(directory, files[0]);
            if (!file.loaded) {
                busy(true);
                await file.loadInfo().finally(_ => {busy(false)}); // Load file info
            }

            /** Show file info **/
            $('#file-info-perm-user').text(file.permissions.toString('user') + (currentUser === file.owner ? ' (You)' : ''));
            $('#file-info-perm-group').text(file.permissions.toString('group'));
            $('#file-info-perm-other').text(file.permissions.toString('other'));

            $('#file-info-title').text(file.name);
            $('#file-info-size').text(file.fileSizeString);
            $('#file-info-owner').text(file?.owner || 'Unknown');
            $('#file-info-modified').text(file.lastModified || 'Unknown');
        })();
    }
}

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
            if (cachedFiles.length !== serverFiles.length || cachedFiles.some((file, i) => file.name !== serverFiles[i])) {
                storeFiles(serverFiles, currentDir, true);
                loadFileViewer();
                console.log('Received incoming changes');
            }
        }) // TODO: Handle errors
        .catch(_ => console.log(_));
}

/**
 * Event handler for the process status event.
 * This can be uploading, downloading, or something else.
 * Once called, the method will look for the target element and update the progress bar accordingly.
 * If the element does not exist, it will be created. If the process is finished, the element will be removed.
 * @param {{type: string, progress: number, finished: boolean}} status The status of the process
 */
window.events.on('process-status', (status) => {

    // Check whether the provided argument has all the necessary properties.
    if (status.hasOwnProperty('type') && typeof status.type === 'string' &&
        status.hasOwnProperty('progress') && typeof status.progress === 'number' &&
        status.hasOwnProperty('finished') && typeof status.finished === 'boolean') {

        // Get the target element
        let target = document.getElementById(`#pgb-${status.type}`);

        // If the target element does not exist, we create it.
        if (target.length == null && !status.finished) {

            target = document.createElement('div');
            target.classList.add('progress-bar');
            target.id = `pgb-${status.type}`;
            document.querySelector('.progress-bars').appendChild(target);
        }
        target.style.setProperty('--progress', status.progress);
        if (status.finished) {
            target.remove();
        }
    }
});