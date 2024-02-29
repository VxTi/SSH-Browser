"use strict";
let busy = (state) =>
{
    $('.process-loading').css('visibility', state ? 'visible' : 'hidden')
};

/** @type {string | undefined} */
let currentUser = undefined

/** @type JQuery<HTMLElement> */
let fileContainer = null

/** @type {File | null} */
let fileRenameTarget = null;

/**
 * History of user navigation
 * @type {Array<{from: string, to: string}>}
 */
let navigationHistory = [];
let navigationHistoryIndex = 0;

// Which element the context menu is targeting
let contextMenuTarget = null;

// Register all keybind mappings for the file viewer
registerKeybindMapping({
    'create_directory': createDirectory,
    'download_file': downloadSelected,
    'delete_file': deleteSelected,
    'reload_page': reloadContent,
    'file_info': showFileInfo,
    'open_file': addFiles,
    'navigate_home': () => navigateTo(homeDir),
    'select_all_files': () => getFileElements().forEach(e => e.setAttribute('selected', '')),
    'deselect_all_files': () => getFileElements().forEach(e => e.removeAttribute('selected')),
    'navigate_back': () => {
        if (navigationHistoryIndex > 0)
        {
            navigationHistoryIndex--;
            navigateTo(navigationHistory[navigationHistoryIndex].from);
        }
    },
    'navigate_forward': () => {
        if (navigationHistoryIndex < navigationHistory.length - 1)
        {
            console.log('Navigate forward with keybinds')
            navigationHistoryIndex++;
            navigateTo(navigationHistory[navigationHistoryIndex].to);
        }
    },
    'navigate_directory': () => {
        let selected = getSelectedFiles()
        if (selected.length === 1)
            navigateTo(selected[0].getAttribute('path') + '/' + selected[0].getAttribute('name'))
    },
    'select_next_file': () => {
        let selected = $('file-element[selected]:not(.path-separator)');
        let next = selected.next()
        if (selected.length === 0 || next.length === 0)
            next = $('file-element:not(.path-separator)').first();
        selected.removeAttr('selected');
        next.attr('selected', '');
    },
    'select_previous_file': () =>
    {
        let selected = $('file-element[selected]:not(.path-separator)');
        let next = selected.prev()
        if (selected.length === 0 || next.length === 0)
            next = $('file-element:not(.path-separator)').last();
        selected.removeAttr('selected');
        next.attr('selected', '');
    },
    'invert_selection': () => {
        getFileElements().forEach(e => e.hasAttribute('selected') ?
            e.removeAttribute('selected') : e.setAttribute('selected', ''))
    }
})

$(document).ready(() =>
{
    // Add loading animation (bottom right)
    addLoadingSpinner($('.process-loading')[0]);
    $('#log-out').on('click', () => window.location.href = '../index.html');

    fileContainer = $('.file-container');

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
    $(document).on('click', _ => $('#context-menu').css('display', 'none'));

    // When a user double-clicks on the document, we deselect all files and hide the file information.
    $(document).on('dblclick', () => $('file-element[selected]').each((i, e) =>
    {
        e.removeAttribute('selected')
        $('.file-information').attr('hidden', '')
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

        // Which items are enabled in the context menu
        /** @type {HTMLElement[]} */
        let enabled = []

        contextMenuTarget = event.target;

        // Check if the clicked-on element is a file
        if (contextMenuTarget instanceof FileElement)
        {
            document.querySelectorAll('file-element')
                .forEach(e => e.removeAttribute('selected'))

            contextMenuTarget.setAttribute('selected', '')

            fileRenameTarget = getFile(contextMenuTarget.getAttribute('path'), contextMenuTarget.getAttribute('name'))
            enabled.push(
                ...(['info', 'delete', 'rename', 'download', 'cpy-path', 'open-with']
                    .map(e => document.getElementById(`ctx-${e}`)))
            );
            if (contextMenuTarget.hasAttribute('executable'))
                enabled.push(document.getElementById('ctx-execute'));
        }

        // Disable all context actions first.
        $('#context-menu > .ctx-item').addClass('disabled');

        // If the target has a 'context-menu' dataset property, we enable the items specified in the property.
        // First, check whether it has a 'context-menu' dataset property.
        if (contextMenuTarget.dataset['contextMenu'])
        {
            let items = contextMenuTarget.dataset.contextMenu.split(' ');
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
            const menu = $('#context-menu');
            menu.css('display', 'block');
            ensureFrameWithinWindow(menu, event.clientX, event.clientY, {left: 5, top: 5, right: 5, bottom: 5})
        }
    });

    /** IMPLEMENTATION OF CONTEXT MENU FUNCTIONALITY **/

    // Downloading a selected file
    $('#ctx-download').on('click', () => downloadSelected())

    let renameFileInput = $('#file-rename');

    // Viewing the information of a selected file
    $('#ctx-info').on('click', () => showFileInfo());

    // Copy file path
    $('#ctx-cpy-path').on('click', () =>
    {
        if (contextMenuTarget instanceof FileElement)
        {
            navigator.clipboard.writeText(contextMenuTarget.getAttribute('path') + '/' + contextMenuTarget.getAttribute('name'))
                .catch(_ => window.logger.log('Error occurred whilst attempting to copy path', _));
        }
    })
    // FIXME: Not working correctly (Broken after making file-element)
    $('#ctx-rename').on('click', () =>
    {
        if (fileRenameTarget !== null)
        {
            renameFileInput.addClass('active');
            renameFileInput.val(fileRenameTarget.name);

            // TODO: Fix this
            let fileNameElement = fileRenameTarget.refElement.querySelector('.file-name');
            fileNameElement.style.opacity = '0';
            renameFileInput.css('left', fileNameElement.offsetLeft);
            renameFileInput.css('top', fileNameElement.offsetTop);
            renameFileInput.focus();
        }
    })
    $('#action-terminal').on('click', () => window.terminal.open(currentDir))
    $('#ctx-new-dir').on('click', createDirectory);    // Create new directory (Context menu)
    $('#action-add-dir').on('click', createDirectory); // Create new directory (Action bar)

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

    /** Functionality for the 'add file' button in the action bar */
    $('#action-add-file').on('click', addFiles);

    /** Functionality for the 'delete file' button in the action bar */
    $('#action-delete-file').on('click', deleteSelected);

    /** Functionality for the 'home' button */
    $('#action-home').on('click', () => navigateTo(homeDir))

    // Add drag and drop functionality
    fileContainer.on('dragover', (e) =>
    {
        e.preventDefault();
        e.stopImmediatePropagation();
    })
        .on('drop', (event) =>
    {
        event = event.originalEvent;
        event.preventDefault();
        event.stopImmediatePropagation();
        // Check if there are any files to upload
        if (!event.dataTransfer?.files || event.dataTransfer.files?.length === 0)
        {
            return;
        }

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

    let pathSegments = currentDir.match(/\/?([^\/]+)/g) || ['/']

    // Add all the path segments to the path container
    // These are just directories
    for (let i = 0; i < pathSegments.length; i++)
    {
        let pathElement = document.createElement('file-element');
        pathElement.setAttribute('name', pathSegments[i].replace('/', ''));
        if (i === 0)
            pathElement.setAttribute('nick-name', 'root')
        pathElement.setAttribute('path', pathSegments.slice(0, i).join(''))
        pathElement.setAttribute('directory', '')
        pathElement.setAttribute('type', 'dir')
        pathElement.setAttribute('path-segment', '')
        pathElement.classList.add('path-separator');

        pathElement.addEventListener('click', () =>
            navigateTo(pathElement.getAttribute('path') + '/' + pathElement.getAttribute('name')))

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
    getFiles(path).forEach(file => fileContainer.get(0).appendChild(createFileElement(file)));
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

    $('.file-section').attr('data-path', target);
    $('#context-menu').css('display', 'none');
    $('.file-information').attr('hidden', '');
    console.log("Attempting to navigate to ", target);

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
            //window.location.href = '../index.html';
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
    fileElement.addEventListener('click', (event) =>
    {
        // Deselect all other files
        $('file-element').removeAttr('selected');
        fileElement.setAttribute('selected', '');

        // Prevent further propagation of the event.
        event.preventDefault();
        event.stopImmediatePropagation();
    })
    return fileElement;
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
 * Function for getting all the selected files in the file viewer.
 * Excludes path separators.
 * @returns {HTMLElement[]}
 */
function getSelectedFiles()
{
    return [...document.querySelectorAll('file-element[selected]:not(.path-separator)')]
}

function getFileElements()
{
    return [...document.querySelectorAll('file-element:not(.path-separator)')];
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
    let selectedFiles = getSelectedFiles()
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
    let selected = getSelectedFiles();

    // If there aren't any files selected, stop.
    if (selected.length === 0)
        return;

    // Cannot delete home or root directory.
    if (selected.some(e => e.getAttribute('path') === homeDir || e.getAttribute('path') === '/'))
        return;

    busy(true);
    Promise.all(selected.map(e => window.ssh.deleteFile(e.getAttribute('path'), e.getAttribute('name'))))
        .then(_ =>
        {
            fileCache.set(currentDir, getFiles(currentDir).filter(f => !selected.some(e => e.getAttribute('name') === f.name)));
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

/**
 * Function for showing the file information of the currently selected file.
 */
async function showFileInfo()
{
    let selected = getSelectedFiles()
    if (selected.length === 0)
        return;

    let file = getFile(selected[0].getAttribute('path'), selected[0].getAttribute('name'));
    if (file === null)
        return;

    if (!file.loaded)
    {
        busy(true);
        await file.loadInfo().finally(_ => busy(false))
    }

    const fileInfo = $('.file-information');
    const clientRect = selected[0].getBoundingClientRect();
    fileInfo.removeAttr('hidden');

    ensureFrameWithinWindow(fileInfo,
        clientRect.left + clientRect.width / 2 - fileInfo.width() / 2,
        clientRect.top + clientRect.height + 10);

    // Copy selected element onto file info page
    $('.file-info-preview').css('background-image', `url(${window.resourceFromFileExtension(selected[0].getAttribute('type'))}`);
    $('#file-info-perm-user').text(file.permissions.toString('user') + (currentUser === file.owner ? ' (You)' : ''));
    $('#file-info-perm-group').text(file.permissions.toString('group'));
    $('#file-info-perm-other').text(file.permissions.toString('other'));

    $('#file-info-title').text(file.name);
    $('#file-info-size').text(file.fileSizeString);
    $('#file-info-owner').text(file?.owner || 'Unknown');
    $('#file-info-modified').text(file.lastModified || 'Unknown');
}

/**
 * Function for ensuring the provided window stays within boundaries of the window.
 * @param {JQuery<HTMLElement> | string} frame The frame to ensure within the window. Can be a selector or a jQuery object.
 * @param {number} nextLeft The next left position of the frame
 * @param {number} nextTop The next top position of the frame
 * @param {{left: number, top: number, right: number, bottom: number}} [margins = {left: 0, top: 0, right: 0, bottom: 0}] The margins to keep from the window edges
 */
function ensureFrameWithinWindow(frame, nextLeft, nextTop, margins = {left: 0, top: 0, right: 0, bottom: 0})
{
    if (typeof frame === 'string')
        frame = $(frame);
    frame.css('left', Math.max(margins.left, Math.min(window.innerWidth - frame.width() - margins.right, nextLeft)))
    frame.css('top', Math.max(margins.bottom, Math.min(window.innerHeight - frame.height() - margins.top, nextTop)))
}