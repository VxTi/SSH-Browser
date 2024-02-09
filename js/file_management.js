let busy = (state) => {$('.process-loading').css('visibility', state ? 'visible' : 'hidden')};

/** @type {string | undefined} */
let currentUser = undefined

let fileContainer = null

/** @type {File | null} */
let fileRenameTarget = null;

/**
 * History of user navigation
 */
let navigationHistory = [];
let navigationHistoryIndex = 0;

// Which element the context menu is targeting
let ctxTarget = [];

$(document).ready(() => {
    // Add loading animation (bottom right)
    addLoadingSpinner($('.process-loading')[0]);
    $('#back-main').on('click', () => window.location.href = '../index.html');

    // Resizing of the file information section
    $('.file-information-resize').on('dblclick', _ => $('.file-information').addClass('hidden'))

    fileContainer = document.querySelector('.file-container');

    // Load in the files from the current directory
    // If this fails, we redirect the user to the main menu.
    busy(true);
    window.ssh.startingDir()
        .then(res => {
            currentDir = res.path;
            storeFiles(res.files, res.path);
            loadFileViewer();
        })
        .catch(_ => {
            window.logger.log(_);
            window.location.href = '../index.html'
        })
        .finally(_ => {busy(false)});

    // Periodically refresh the page to check for incoming changes.
    setInterval(checkFsDifferences, 3000);

    // When the user clicks on the screen outside a file element, hide the context menu.
    $(document).on('click', _ => $('.context-menu').removeClass('active'));

    // When a user double-clicks on the document, we deselect all files and hide the file information.
    $(document).on('dblclick', () => $('.file.selected').removeClass('selected'))

    /** - - - - - - - - - - - - - - - **
     | Context menu (Right-clicking)   |
     ** - - - - - - - - - - - - - - - **/
    $(document).on('contextmenu', async (event) => {
        // If the document isn't focused we can't check for context menu interaction.
        // Errors will be thrown otherwise.
        if (!document.hasFocus())
            return;
        event.preventDefault();
        event.stopImmediatePropagation();

        // Select potential file
        let target = event.target.parentElement || event.target;

        // Which items are enabled in the context menu
        /** @type {HTMLElement[]} */
        let enabled = [];

        ctxTarget = [target];

        // Check if the clicked-on element is a file
        if (target.classList.contains('file')) {
            $('.file').removeClass('selected');
            target.classList.add('selected');
            fileRenameTarget = getFile(target.dataset.path, target.dataset.name);
            ctxTarget = [...document.querySelectorAll('.file.selected')];
            enabled.push(
                ...['info', 'delete', 'rename', 'download', 'cpy-path']
                    .map(e => document.getElementById('ctx-' + e))
            );
        }

        // Disable all context actions first.
        $('.context-menu-item').addClass('disabled');

        // If the target has a 'context-menu' dataset property, we enable the items specified in the property.
        // First, check whether it has a 'context-menu' dataset property.
        if (target.dataset.hasOwnProperty('contextMenu')) {
            let items = target.dataset.contextMenu.split(' ');
            items.forEach(ctxMenuItem => {
                let element = document.getElementById('ctx-' + ctxMenuItem.trim());

                if (element !== null)
                    enabled.push(element);
            })
        }
        enabled.forEach(e => e.classList.remove('disabled'));
        // If there's any enabled items, we show the context menu.
        if (enabled.length > 0) {
            let menu = document.querySelector('.context-menu');

            // Moving the context menu to the cursor's position
            menu.style.left = event.clientX + 'px';
            menu.style.top = event.clientY + 'px';

            menu.classList.add('active');
        }
    });

    /** IMPLEMENTATION OF CONTEXT MENU FUNCTIONALITY **/

    // Downloading a selected file
    $('#ctx-download').on('click', () => {
        // Check if there's anything selected
        if (ctxTarget.length > 0) {
            // Filter out all elements that don't have a path and name (non-files)
            ctxTarget = ctxTarget.filter(e => e.dataset.path && e.dataset.name)
            Promise.all(ctxTarget.map(e => window.ssh.downloadFile(e.dataset.path, e.dataset.name)))
                .catch(_ => console.error('Error occurred whilst attempting to download file', _));
        }
    })

    const mkdir = () => {
        console.log("creating directory")
        let files = getFiles(currentDir);
        let name = 'New Directory';
        for (let i = 1; files.find(f => f.name === name); i++)
            name = `New Directory (${i})`;

        window.ssh.createDirectory(currentDir, name)
            .catch(_ => console.log('Error occurred whilst attempting to create new directory', _));
    }

    // Viewing the information of a selected file
    $('#ctx-info').on('click', () => {
        if (ctxTarget.length > 0) {
            ctxTarget = ctxTarget.filter(e => e.dataset.path && e.dataset.name)
            showPreview(ctxTarget.map(e => e.dataset.name), ctxTarget[0].dataset.path);
        }
    })

    // Copy file path
    $('#ctx-cpy-path').on('click', () => {
        // Filter out all elements that don't have a path (non-files / directories)
        ctxTarget = ctxTarget.filter(e => e.dataset.path);
        if (ctxTarget.length > 0) {
            navigator.clipboard.writeText(ctxTarget[0].dataset.path)
                .catch(_ => console.log('Error occurred whilst attempting to copy path', _));
        }
    })

    let renameFileInput = $('#file-rename');
    $('#ctx-rename').on('click', () => {
        if (fileRenameTarget !== null) {
            renameFileInput.addClass('active');
            renameFileInput.val(fileRenameTarget.name);
            let fileNameElement = fileRenameTarget.refElement.querySelector('.file-name');
            fileNameElement.style.opacity = 0;
            renameFileInput.css('left', fileNameElement.offsetLeft);
            renameFileInput.css('top', fileNameElement.offsetTop);
            renameFileInput.focus();
        }
    })

    // Create new directory (Context menu)
    $('#ctx-new-dir').on('click', () => mkdir());

    // Create new directory (Action bar)
    $('#action-add-dir').on('click', () => mkdir());

    renameFileInput.on('keypress', (e) => {
        // If there isn't any file targetted for renaming, we hide the input and return.
        e.stopImmediatePropagation()
        if (fileRenameTarget == null) {
            renameFileInput.removeClass('active')
            return;
        }

        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                fileRenameTarget.rename(e.target.value)
                    .then(_ => {
                        renameFileInput.removeClass('active');
                        fileRenameTarget.refElement.querySelector('.file-name').style.opacity = 1;
                        fileRenameTarget = null;
                        loadFileViewer();
                    })
                    .catch(_ => console.log('Error occurred whilst attempting to rename file', _))
                break;
            case 'Escape':
                fileRenameTarget = null;
                renameFileInput.removeClass('active');
                break;
        }
    })

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
    document.getElementById('action-add-file').onclick = () => {

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
    document.getElementById('action-delete-file').onclick = () => {
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

        if (event.dataTransfer.files.length === 0)
            return;

        /** @type {string[]} */
        let pathArr = [];
        for (const f of event.dataTransfer.files)
            pathArr.push(f.path);

        busy(true);
        window.ssh.uploadFiles(currentDir, pathArr)
            .then(_ => {
                // get current files in currentDir, map paths to file objects and add to fileCache
                getFiles(currentDir).push(...pathArr.map(p =>
                    new File(p.substring(p.lastIndexOf('/') + 1), p.substring(0, p.lastIndexOf('/')))));
                loadFileElements();
            })
            .finally(_ => {busy(false)});
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
    if (pathSegments[pathSegments.length - 1] === '')
        pathSegments.pop();

    // Add all the path segments to the path container
    // These are just directories
    for (let i = 0; i < pathSegments.length; i++) {
        let seg = pathSegments[i];

        /** Path segment element on the bottom of the page **/
        let directory = document.createElement('div');
        directory.classList.add('path-separator');

        directory.dataset.path = pathSegments.slice(0, i + 1).join('/').trim() || '/';
        directory.dataset.name = seg;
        directory.innerText = seg;
        if (i === 0)
            directory.innerText = 'root';

        directory.addEventListener('click', () => navigateTo(directory.dataset.path))

        /** Directory separator arrow **/
        let arrow = document.createElement('div');
        arrow.classList.add('path-arrow');

        pathContainer.appendChild(arrow);
        pathContainer.appendChild(directory);
    }

    // Clear all previously shown files and show all
    // files in the current working directory.
    loadFileElements();
}

/**
 * Method for loading all files in the currently selected directory.
 * This method converts the files in 'fileCache[currentDir]' into elements.
 * @param {string} path The path in which the files are located at. Default is the current directory.
 * @param {boolean} clearOld Whether to remove all previously shown files or not. Default is true.
 */
function loadFileElements(path = currentDir, clearOld = true) {

    // remove all old files if
    if (clearOld) $('.file').remove();

    // Add all files to the file container
    getFiles(path).forEach(file => fileContainer.appendChild(createFileElement(file)));
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

    if (target instanceof File) // Convert to viable path
        target = target.path + (target.directory ? '/' + target.name : '')

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
            window.terminal.execute(`cd '${target}'`) // Change directory in the terminal
        })
        .catch(_ => {
            window.logger.log('Error occurred whilst attempting to navigate', _)
            window.location.href = '../index.html';
        })
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
function showPreview(files, directory = currentDir) {

    if (files.length === 0)
        return;

    let preview = document.querySelector('.file-info-preview');
    $('.file-information').removeClass('hidden');

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
            serverFiles = serverFiles.filter(f => f.length > 0);
            // Compare files, if there's any difference, update the file viewer
            if (cachedFiles.length !== serverFiles.length || cachedFiles.some((file, i) => file.name !== serverFiles[i])) {
                storeFiles(serverFiles, currentDir, true);
                loadFileViewer();
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
        let target = document.getElementById(`pgb-${status.type}`);

        // If the target element does not exist, we create it.
        if (target == null && !status.finished) {

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