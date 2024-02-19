let busy = (state) =>
{
    $('.process-loading').css('visibility', state ? 'visible' : 'hidden')
};

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

$(document).ready(() =>
{
    // Add loading animation (bottom right)
    addLoadingSpinner($('.process-loading')[0]);
    $('#log-out').on('click', () => window.location.href = '../index.html');

    // Resizing of the file information section
    $('.file-information-resize').on('dblclick', _ => $('.file-information').addClass('hidden'))

    fileContainer = document.querySelector('.file-container');

    // Load in the files from the current directory
    // If this fails, we redirect the user to the main menu.
    busy(true);
    window.ssh.startingDir()
        .then(res =>
        {
            /** Current dir is defined in file_caching.js **/
            currentDir = res.path;
            homeDir = res.path;
            document.querySelector('.file-section').dataset.path = res.path;
            storeFiles(res.files, res.path);
            loadFileViewer();
        })
        .catch(_ =>
        {   // If an error occurs whilst attempting to list files, it's likely due to a connection error.
            // If this happens, we'll redirect the user to the main menu.
            window.logger.log(_);
            window.location.href = '../index.html'
        })
        .finally(_ =>
        {
            busy(false)
        });

    // Periodically refresh the page to check for incoming changes.
    setInterval(checkFsDifferences, 3000);

    // When the user clicks on the screen outside a file element, hide the context menu.
    $(document).on('click', _ => $('.context-menu').removeClass('active'));

    // When a user double-clicks on the document, we deselect all files and hide the file information.
    $(document).on('dblclick', () => $('file-element[selected]').each((i, e) =>
    {
        e.removeAttribute('selected')
        $('.file-information').addClass('hidden')
    }))

    /** - - - - - - - - - - - - - - - **
     | Context menu (Right-clicking)   |
     ** - - - - - - - - - - - - - - - **/
    $(document).on('contextmenu', async (event) =>
    {
        // If the document isn't focused we can't check for context menu interaction.
        // Errors will be thrown otherwise.
        if (!document.hasFocus())
            return;
        event.preventDefault();
        event.stopImmediatePropagation();

        // Select potential file
        let targetElement = event.target

        // Which items are enabled in the context menu
        /** @type {HTMLElement[]} */
        let enabled = []

        ctxTarget = [targetElement];

        // Check if the clicked-on element is a file
        if (targetElement instanceof FileElement)
        {
            document.querySelectorAll('file-element')
                .forEach(e => e.removeAttribute('selected'))
            targetElement.setAttribute('selected', '')
            fileRenameTarget = getFile(targetElement.getAttribute('path'), targetElement.getAttribute('name'))
            ctxTarget = [...document.querySelectorAll('file-element[selected]')]
            enabled.push(
                ...['info', 'delete', 'rename', 'download', 'cpy-path']
                    .map(e => document.getElementById('ctx-' + e))
            );
        }

        // Disable all context actions first.
        $('.ctx-item').addClass('disabled');

        // If the target has a 'context-menu' dataset property, we enable the items specified in the property.
        // First, check whether it has a 'context-menu' dataset property.
        if (targetElement.dataset.hasOwnProperty('contextMenu'))
        {
            let items = targetElement.dataset.contextMenu.split(' ');
            items.forEach(ctxMenuItem =>
            {
                let element = document.getElementById('ctx-' + ctxMenuItem.trim());

                if (element !== null)
                    enabled.push(element);
            })
        }
        enabled.forEach(e => e.classList.remove('disabled'));
        // If there's any enabled items, we show the context menu.
        if (enabled.length > 0)
        {
            let menu = document.querySelector('.context-menu');

            // Moving the context menu to the cursor's position
            menu.style.left = event.clientX + 'px';
            menu.style.top = event.clientY + 'px';

            menu.classList.add('active');
        }
    });

    /** IMPLEMENTATION OF CONTEXT MENU FUNCTIONALITY **/

    // Downloading a selected file
    $('#ctx-download').on('click', () => downloadSelected())

    let renameFileInput = $('#file-rename');

    // Viewing the information of a selected file
    $('#ctx-info').on('click', () =>
    {
        if (ctxTarget.length > 0)
        {
            ctxTarget = ctxTarget.filter(e => e && e.hasAttribute('path') && e.hasAttribute('name'))
            showPreview(
                ctxTarget.map(e => e.getAttribute('name')),
                ctxTarget[0].getAttribute('path')
            );
        }
    })

    // Copy file path
    $('#ctx-cpy-path').on('click', () =>
    {
        // Filter out all elements that don't have a path (non-files / directories)
        ctxTarget = ctxTarget.filter(e => e.dataset.path);
        if (ctxTarget.length > 0)
        {
            navigator.clipboard.writeText(ctxTarget[0].dataset.path)
                .catch(_ => window.logger.log('Error occurred whilst attempting to copy path', _));
        }
    })

    $('#ctx-rename').on('click', () =>
    {
        if (fileRenameTarget !== null)
        {
            renameFileInput.addClass('active');
            renameFileInput.val(fileRenameTarget.name);
            let fileNameElement = fileRenameTarget.refElement.querySelector('.file-name');
            fileNameElement.style.opacity = '0';
            renameFileInput.css('left', fileNameElement.offsetLeft);
            renameFileInput.css('top', fileNameElement.offsetTop);
            renameFileInput.focus();
        }
    })

    // Create new directory (Context menu)
    $('#ctx-new-dir').on('click', createDirectory);

    // Create new directory (Action bar)
    $('#action-add-dir').on('click', createDirectory);

    renameFileInput.on('keypress', (e) =>
    {
        // If there isn't any file targetted for renaming, we hide the input and return.
        e.stopImmediatePropagation()
        if (fileRenameTarget == null)
        {
            renameFileInput.removeClass('active')
            return;
        }

        switch (e.key)
        {
            case 'Enter':
                e.preventDefault();
                fileRenameTarget.rename(e.target.value)
                    .then(_ =>
                    {
                        renameFileInput.removeClass('active');
                        fileRenameTarget.refElement.querySelector('.file-name').style.opacity = '1';
                        fileRenameTarget = null;
                        loadFileViewer();
                    })
                    .catch(_ => window.logger.log('Error occurred whilst attempting to rename file', _))
                break;
            case 'Escape':
                fileRenameTarget = null;
                renameFileInput.removeClass('active');
                break;
        }
    })

    // Add file filtering functionality
    $('#file-filter').on('input', (event) =>
        $('file-element').each((i, file) =>
        {
            if (file.getAttribute('name').indexOf(event.target.value) < 0)
                file.setAttribute('hidden', '')
            else
                file.removeAttribute('hidden');
        }))

    /** Functionality for the 'refresh' button in the action bar */
    $('#action-refresh').on('click', reloadContent);

    /**
     * Functionality for the 'add file' button in the action bar
     */
    $('#action-add-file').on('click', addFiles);

    /**
     * Functionality for the 'delete file' button in the action bar
     */
    $('#action-delete-file').on('click', deleteSelected);

    /** Functionality for the 'home' button */
    $('#action-home').on('click', () => navigateTo(homeDir))

    /**
     * Add keyboard functionality.
     * Example, moving through files with arrow keys,
     * Deleting files, etc.
     */
    $(document).on('keydown', (e) =>
    {
        let selected = $('file-element[selected]')

        let next = null;
        let specialFunction = e.ctrlKey || e.metaKey;
        switch (e.key)
        {
            case 'Enter': /** TODO: Add keybind settings */
                // If the selected file is a directory, we open it.
                if (selected.length === 1 && selected.first().prop('directory'))
                    navigateTo(selected.first().attr('path') + '/' + selected.first().attr('name'));
                break;
            case 'Backspace': /** TODO: Add keybind settings */
                // If the CTRL (macOS) or CTRL (Windows) key is pressed, we delete the file.
                if (specialFunction)
                    deleteSelected()
                break;
            case 'ArrowLeft': /** TODO: Add keybind settings */
                next = selected.prev()
                if (selected.length === 0 || next.length === 0)
                    next = $('file-element').last();
                break;
            case 'ArrowRight': /** TODO: Add keybind settings */
                next = selected.next()
                if (selected.length === 0 || next.length === 0)
                    next = $('file-element').first();
                break;
            case 'ArrowUp': /** TODO: Add keybind settings */
                break;
            case 'ArrowDown': /** TODO: Add keybind settings */
                    break;
            case 'Escape': /** TODO: Add keybind settings */
                selected.removeAttr('selected');
                break;
            case 'i': /** TODO: Add keybind settings and optimize */
                if (specialFunction)
                {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    ctxTarget = [selected.get(0)];
                    $('#ctx-info').trigger('click');
                }
                break;
            case 'r': /** TODO: Add keybind settings and optimize */
                if (specialFunction)
                {
                    e.preventDefault()
                    e.stopImmediatePropagation()
                    ctxTarget = [selected.get(0)]
                    reloadContent()
                }
                break;
            case 'o': /** TODO: Add keybind settings and optimize */
                if (specialFunction)
                {
                    e.preventDefault()
                    e.stopImmediatePropagation()
                    addFiles()
                }
                break;
            case 'd': /** TODO: Add keybind settings and optimize */
                if (specialFunction)
                {
                    e.preventDefault()
                    e.stopImmediatePropagation()
                    downloadSelected()
                }
                break;
        }

        if (next)
        {
            if (!e.shiftKey)
                selected.removeAttr('selected');
            next.attr('selected', '');
        }
    });
    // Add drag and drop functionality
    document.addEventListener('dragover', (e) =>
    {
        e.preventDefault();
        e.stopImmediatePropagation();
    });

    // Drag 'n drop files to the file viewer
    // This will upload the files to the server.
    document.addEventListener('drop', (event) =>
    {
        if (event.dataTransfer.files.length === 0)
            return;

        event.preventDefault();
        event.stopImmediatePropagation();

        /** @type {string[]} */
        let pathArr = [];
        for (const f of event.dataTransfer.files)
            pathArr.push(f.path);

        busy(true);
        window.ssh.uploadFiles(currentDir, pathArr)
            .then(_ =>
            {
                // Update the file cache with the new files
                getFiles(currentDir).push(...pathArr.map(p =>
                    new File(p.substring(p.lastIndexOf('/') + 1), p.substring(0, p.lastIndexOf('/')))));
                loadFileElements();
            })
            .finally(_ =>
            {
                busy(false)
            });
    });
    $('#navigate-back').on('click', () =>
    {
        if (navigationHistoryIndex > 0)
        {
            navigationHistoryIndex--;
            navigateTo(navigationHistory[navigationHistoryIndex].from);
        }
    })
    $('#navigate-forward').on('click', () =>
    {
        if (navigationHistoryIndex < navigationHistory.length - 1)
        {
            navigationHistoryIndex++;
            navigateTo(navigationHistory[navigationHistoryIndex].to);
        }
    })
});

/**
 * Loading in the functionality of the file viewer.
 * All files that are loaded are cached in the 'fileCache' object.
 * These are then converted into elements visible on the screen.
 * All previously visible files will be removed upon calling this function.
 */
function loadFileViewer()
{

    if (currentUser === undefined)
        currentUser = window.ssh.sessions.currentSession().username;

    // If for whatever reason currentDir is not defined, return to home menu.
    if (currentDir === undefined)
    {
        window.location.href = '../index.html';
        return;
    }

    // Remove all previous segments from previous queries

    $('.path-arrow, file-element').remove();

    let pathContainer = document.querySelector('.path-section');

    let pathSegments = currentDir.split('/') || [''];
    if (pathSegments[pathSegments.length - 1] === '')
        pathSegments.pop();

    // Add all the path segments to the path container
    // These are just directories
    for (let i = 0; i < pathSegments.length; i++)
    {
        let seg = pathSegments[i];

        /** Path segment element on the bottom of the page **/
        /*let directory = document.createElement('div');
        directory.classList.add('path-separator');
        directory.setAttribute('directory', '')

        directory.dataset.path = pathSegments.slice(0, i + 1).join('/').trim() || '/';
        directory.dataset.name = seg;
        directory.innerText = seg;
        if (i === 0)
            directory.innerText = 'root';*/

        // Check if the file-element is defined, if not, we throw an error.
        // This is to prevent the file viewer from breaking.

        let pathElement = document.createElement('file-element');
        pathElement.setAttribute('name', seg)
        if (i === 0)
            pathElement.setAttribute('nick-name', 'root')
        pathElement.setAttribute('path', pathSegments.slice(0, i + 1).join('/').trim() || '/')
        pathElement.setAttribute('directory', '')
        pathElement.setAttribute('type', 'dir')
        pathElement.setAttribute('path-segment', '')
        pathElement.classList.add('path-separator');

        pathElement.addEventListener('click', () => navigateTo(pathElement.getAttribute('path')))

        /** Directory separator arrow **/
        let arrow = document.createElement('div');
        arrow.classList.add('path-arrow');
        pathContainer.appendChild(arrow);
        pathContainer.appendChild(pathElement);
    }

    // Load all files in the current directory
    loadFileElements();
}

/**
 * Method for loading all files in the currently selected directory.
 * This method converts the files in 'fileCache[currentDir]' into elements.
 * @param {string} path The path in which the files are located at. Default is the current directory.
 * @param {boolean} clearOld Whether to remove all previously shown files or not. Default is true.
 */
function loadFileElements(path = currentDir, clearOld = true)
{

    // Remove all old files from the file container (excluding path segments)
    if (clearOld) $('file-element:not(.path-separator)').remove();

    // Add all files to the file container
    getFiles(path).forEach(file => fileContainer.appendChild(createFileElement(file)));
}

/**
 * Method for navigating to a different directory.
 * @param {string | File} target The directory to navigate to.
 */
function navigateTo(target)
{

    if (target instanceof File) // Convert to viable path
        target = target.path + (target.directory ? '/' + target.name : '')

    // If we're already on there, don't proceed.
    if (target === currentDir)
        return;
    document.querySelector('.file-section').dataset.path = target;

    busy(true);
    window.ssh
        .listFiles(target) // Retrieve files from selected directory
        .then(result =>
        {
            navigationHistory.push({from: currentDir, to: target});
            navigationHistoryIndex++
            storeFiles(result, target);
            currentDir = target;
            loadFileViewer(); // reload the file viewer
            $('.path-section').animate({scrollLeft: $('.path-section').width()}, 300)
            window.terminal.execute(`cd '${target}'`) // Change directory in the terminal
        })
        .catch(_ =>
        {   // If an error occurs whilst
            window.logger.log('Error occurred whilst attempting to navigate', _)
            window.location.href = '../index.html';
        })
        .finally(_ =>
        {
            busy(false)
        });
}

/**
 * Method for creating a file element.
 * @param {File} file The file object to create an element for
 * @returns {HTMLDivElement} The file element created
 */
function createFileElement(file)
{
    // Main file element. Here we add all functionality for whenever a user interacts with it.
    // This can be dragging, opening, moving, etc.

    let fileElement = document.createElement('file-element');
    fileElement.setAttribute('name', file.name);
    fileElement.setAttribute('path', file.path);
    fileElement.setAttribute('type', file.directory ? 'dir' : file.name.substring(file.name.lastIndexOf('.') + 1));
    if (file.directory)
        fileElement.setAttribute('directory', '')

    /** File interact functionality **/

    // When one double-clicks on a file, we open it.
    fileElement.addEventListener('dblclick', _ => navigateTo(file));

    // When one clicks on a file, we select it.
    // If we're in column view, we open the directory.
    fileElement.addEventListener('click', async (event) =>
    {

        // Deselect all other files
        $('file-element').removeAttr('selected');
        $('.context-menu').removeClass('active');

        fileElement.setAttribute('selected', '');

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
function showPreview(files, directory = currentDir)
{
    if (files.length === 0)
        return;

    let preview = document.querySelector('.file-info-preview');
    $('.file-information').removeClass('hidden');

    // TODO: Fix this
    // Remove all previous classes and add the correct one
    preview.classList.add('file-info-preview');
    let fileType = files[0].lastIndexOf('.') < 0 ? 'dir' : files[0].substring(files[0].lastIndexOf('.') + 1)
    preview.style.backgroundImage = `url(${window.getIcon(fileType)})`;

    (async () =>
    {
        // If there's only one file, we can show all information about it.
        let file = getFile(directory, files[0]);
        if (!file)
            throw new Error("File not found")
        if (!file.loaded)
        {
            busy(true);
            // Load file info
            await file.loadInfo()?.finally(_ => busy(false)) || busy(false);
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
async function checkFsDifferences()
{
    // Check if there's an active connection, if not, don't proceed.
    if (window.ssh === undefined || currentDir === undefined || !(await window.ssh.connected()))
        return;

    //
    let cachedFiles = getFiles(currentDir);
    window.ssh.listFiles(currentDir)
        .then(result => result.split('\n'))
        .then(serverFiles =>
        {
            serverFiles = serverFiles.filter(f => f.length > 0);
            // Compare files, if there's any difference, update the file viewer
            if (cachedFiles.length !== serverFiles.length || cachedFiles.some((file, i) => file.name !== serverFiles[i]))
            {
                storeFiles(serverFiles, currentDir, true);
                loadFileViewer();
            }
        })
        .catch(_ =>
        {
            // TODO: Add action menu for when connection fails
            window.location.href = '../index.html'

        });
}

/**
 * Event handler for the process status event.
 * This can be uploading, downloading, or something else.
 * Once called, the method will look for the target element and update the progress bar accordingly.
 * If the element does not exist, it will be created. If the process is finished, the element will be removed.
 * @param {{type: string, progress: number, finished: boolean}} status The status of the process
 */
window.events.on('process-status', (status) =>
{

    // Check whether the provided argument has all the necessary properties.
    if (status.hasOwnProperty('type') && typeof status.type === 'string' &&
        status.hasOwnProperty('progress') && typeof status.progress === 'number' &&
        status.hasOwnProperty('finished') && typeof status.finished === 'boolean')
    {
        // Get the target element
        let target = document.getElementById(`pgb-${status.type}`);

        // If the process has finished, we remove the element (if it still exists?)
        if (status.finished)
            target?.remove();
        else
        {
            if (target == null)
            {
                target = document.createElement('div');
                target.classList.add('progress-bar');
                target.id = `pgb-${status.type}`;
                document.querySelector('.progress-bars').appendChild(target);
            }
            target.style.setProperty('--progress', status.progress);
        }
    }
});

/**
 * Function for refreshing the content of the file viewer.
 */
function reloadContent()
{
    busy(true);
    window.ssh.listFiles(currentDir)
        .then(result =>
        {
            storeFiles(result, currentDir, true);
            loadFileViewer();
        })
        .finally(_ =>
        {
            busy(false)
        });
}

/**
 * Function for downloading the currently selected files.
 */
function downloadSelected()
{
    let selectedFiles = [...document.querySelectorAll('file-element[selected]')];
    if (selectedFiles.length === 0)
        return;

    busy(true);
    Promise.all(selectedFiles.map((element) =>
        window.ssh.downloadFile(element.getAttribute('path'), element.getAttribute('name'))))
        .catch(e => window.logger.error('Error occurred whilst attempting to download file', e))
        .finally(_ =>
        {
            busy(false)
        });
}

/**
 * Function for deleting the currently selected files.
 */
function deleteSelected()
{

    let selected = [...document.querySelectorAll('file-element[selected]')];
    if (selected.length === 0)
        return;

    busy(true);
    Promise.all(selected.map(e => window.ssh.deleteFile(e.getAttribute('path'), e.getAttribute('name'))))
        .then(_ =>
        {
            // Remove them from the DOM
            // Automatic file system reloading will take care
            // of file cache updates.
            selected.forEach(e => e.remove());
        })
        .catch(e => window.logger.error('Error occurred whilst attempting to delete file', e))
        .finally(_ =>
        {
            busy(false)
        });
}

/**
 * Function for creating a new directory
 */
function createDirectory()
{
    let files = getFiles(currentDir);
    let name = 'New Directory';
    for (let i = 1; files.find(f => f.name === name); i++)
        name = `New Directory (${i})`;
    window.ssh.createDirectory(currentDir, name)
        .catch(_ => window.logger.log('Error occurred whilst attempting to create new directory', _));
}

/**
 * Function for uploading files from the local file system to the remote file system.
 */
function addFiles()
{
    busy(true);
    window.ssh.selectFiles()
        .then(files =>
        {
            if (files.length < 1)
                return;
            window.ssh.uploadFiles(currentDir, files) // TODO: Error handling
                .finally(_ =>
                {
                    busy(false)
                });
        })
}
