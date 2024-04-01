/**
 * Implementation of the file explorer page.
 * This page is used for browsing the file system of the remote server.
 */

import RemoteFile from "./file/remote-file.js";
import { getFile, getFiles, storeFiles } from "./file/file-caching.js";
import { FileElement } from "../custom-elements/file-element.js";
import { registerKeybindMapping, resourceFromFileExtension } from "../general-functionality.js";
import contextmenu from "../context-menu";
import { FileHierarchyElement } from "../custom-elements/file-hierarchy-element";
import { assembleFileHierarchy } from "./file-hierarchy-impl";

/**
 * @param {Promise<*>} promise The promise which has to be resolved before the loading animation is hidden.
 */
let busy = (promise) =>
{
    let loadingElement = document.querySelector('.process-loading');
    loadingElement.style.visibility = 'visible';
    Promise.resolve(promise).then(_ =>
    {
        loadingElement.style.visibility = 'hidden';
    });
};

/** @type {string | undefined} */
let currentUser = undefined

/** @type HTMLElement */
let fileContainer = null

/** @type {RemoteFile | null} */
let fileRenameTarget = null;

/**
 * History of user navigation
 * @type {Array<{from: string, to: string}>}
 */
let navigationHistory = [];
let navigationHistoryIndex = 0;

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
    'navigate_back': () =>
    {
        if ( navigationHistoryIndex > 0 )
        {
            navigationHistoryIndex--;
            navigateTo(navigationHistory[navigationHistoryIndex].from);
        }
    },
    'navigate_forward': () =>
    {
        if ( navigationHistoryIndex < navigationHistory.length - 1 )
        {
            navigationHistoryIndex++;
            navigateTo(navigationHistory[navigationHistoryIndex].to);
        }
    },
    'navigate_directory': () =>
    {
        let selected = getSelectedFiles()
        if ( selected.length === 1 )
            navigateTo(
                path.join(
                    selected[0].getAttribute('path'),
                    selected[0].getAttribute('name')))
    },
    'select_next_file': () =>
    {
        let selected =
            document.querySelectorAll('file-element[selected]:not(.path-separator)');
        let next = selected[selected.length - 1].nextElementSibling;
        if ( selected.length === 0 || !next )
            next = document.querySelector('file-element:not(.path-separator)');
        [ ...selected ].forEach(s => s.removeAttribute('selected'));
        next.setAttribute('selected', '');
    },
    'select_previous_file': () =>
    {
        let selected = document.querySelectorAll('file-element[selected]:not(.path-separator)');
        let next = selected[0].previousElementSibling;
        if ( selected.length === 0 || !next )
        {
            let elements = document.querySelectorAll('file-element:not(.path-separator)');
            next = elements[elements.length - 1];
        }
        selected.forEach(s => s.removeAttribute('selected'));
        next.setAttribute('selected', '');
    },
    'invert_selection': () =>
    {
        getFileElements().forEach(e => e.hasAttribute('selected') ?
            e.removeAttribute('selected') : e.setAttribute('selected', ''))
    }
})

document.addEventListener('DOMContentLoaded', _ =>
{
    // Add loading animation (bottom right)
    const bladeCount = 8;
    let spinner = document.createElement('div');
    for ( let i = 0; i < bladeCount; i++ )
    {
        let loadingSpinner = document.createElement('div');
        loadingSpinner.classList.add('blade');
        spinner.appendChild(loadingSpinner);
    }
    spinner.classList.add('spinner');
    document.querySelector('.process-loading').appendChild(spinner);
    document.getElementById('log-out')
        .addEventListener('click', () => window.location.href = '../index.html');

    fileContainer = document.getElementById('file-container');

    // Load in the files from the current directory
    // If this fails, we redirect the user to the main menu.
    busy(window.ssh.startingDir()
        .then(res =>
        {
            /** Current dir is defined in file-caching **/
            window.currentDir = res.path;
            window.homeDir = res.path;
            document.querySelector('.inner-content-container').dataset.path = res.path;
            storeFiles(res.files, res.path);
            loadFileViewer();
        })
        .catch(error =>
        {   // If an error occurs whilst attempting to list files, it's likely due to a connection error.
            // If this happens, we'll redirect the user to the main menu.
            window.logger.log(error);
            window.logger.log(error.stack)
            console.error(error)
            //window.location.href = '../index.html'
        }));

    // Periodically refresh the page to check for incoming changes.
    setInterval(checkFsDifferences, 3000);

    // When the user clicks on the screen outside a file element, hide the context menu.
    document.addEventListener('click', event =>
    {
        console.log(event.target)
        if ( event.target instanceof Element && (event.target.id !== 'context-menu' || event.target.parentElement.id !== 'context-menu'))
            contextmenu.destroy();
    });

    // When a user double-clicks on the document, we deselect all files and hide the file information.
    document.addEventListener('dblclick', () =>
    {
        document.querySelectorAll('file-element[selected]')
            .forEach((e) =>
            {
                e.removeAttribute('selected')
                document.querySelector('.file-information').setAttribute('hidden', '')
            })
    })

    /**
     * Context-menu action registration
     * These actions are the ones that become visible when
     * right-clicking on a file-element, or a file-hierarchy-element.
     */
    contextmenu.register('file-element', [
        { title: 'Edit File', type: 'normal', click: (target) => {
                if ( target instanceof FileElement )
                    window.extWindows.openFileEditor(target.getAttribute('path'), target.getAttribute('name'));
            },
            visible: (target) => (target instanceof FileElement || target instanceof FileHierarchyElement)
                && !target.hasAttribute('directory')
        },
        { title: 'Show Information', type: 'normal', click: showFileInfo },
        { title: 'New Folder', type: 'normal', click: createDirectory, visible: (target) => target.hasAttribute('directory') },
        { title: 'Download', type: 'normal', click: downloadSelected },
        { type: 'separator' },
        { title: 'Rename', type: 'normal', click: () => {} },
        { title: 'Clone', type: 'normal', click: cloneSelected },
        { type: 'separator' },
        { title: 'Copy Path', type: 'normal', click: (target) =>
            {
                if ( target && target instanceof Element && target.hasAttribute('path') && target.hasAttribute('name') )
                    navigator.clipboard
                        .writeText(target.getAttribute('path') + '/' + target.getAttribute('name'))
                        .catch(_ => window.logger.log('Error occurred whilst attempting to copy path', _))
            }
        },
        { title: 'Delete', type: 'normal', click: deleteSelected },
    ]);

    document.addEventListener('contextmenu', event =>
    {
        if ( !document.hasFocus() )
            return;

        event.preventDefault();
        event.stopImmediatePropagation();


        console.log(event.target);

        if ( event.target instanceof FileElement || event.target instanceof FileHierarchyElement )
            contextmenu.show('file-element', event.clientX, event.clientY, event.target);
    });

    // 'Terminal' button functionality
    document.getElementById('action-terminal')
        .addEventListener('click', _ => window.extWindows.openTerminal(currentDir));

    // 'Create Directory' button functionality
    document.getElementById('action-add-dir')
        .addEventListener('click', _ => createDirectory());

    /**
     * File filtering functionality implementation
     */
    let fileFilter = document.getElementById('file-filter');
    fileFilter.addEventListener('input', manageFileFilteringInput);
    fileFilter.addEventListener('focus', _ => manageFileFilteringInput());
    document.addEventListener('click', _ =>
    {
        document.getElementById('file-search-results').innerHTML = '';
        document
            .getElementById('file-filter-results-container')
            .setAttribute('hidden', '');
        fileFilter.value = '';
    });

    /** Functionality for the 'refresh' button in the action bar */
    document.getElementById('action-refresh').addEventListener('click', reloadContent);

    /** Functionality for the 'add file' button in the action bar */
    document.getElementById('action-add-file').addEventListener('click', addFiles);

    /** Functionality for the 'delete file' button in the action bar */
    document.getElementById('action-delete-file').addEventListener('click', deleteSelected);

    /** Functionality for the 'home' button */
    document.getElementById('action-home').addEventListener('click', () => navigateTo(homeDir));

    // Add drag and drop functionality
    fileContainer.addEventListener('dragover', (e) =>
    {
        fileContainer.setAttribute('dragging-over', '');
        e.preventDefault();
        e.stopImmediatePropagation();
    });
    fileContainer.addEventListener('dragleave', (event) =>
    {
        fileContainer.removeAttribute('dragging-over');
    });
    fileContainer.addEventListener('drop', (event) =>
    {
        event = event.originalEvent;
        event.preventDefault();
        event.stopImmediatePropagation();
        // Check if there are any files to upload
        if ( !event.dataTransfer.hasOwnProperty('files') || event.dataTransfer.files.length === 0 )
            return;

        /** @type {string[]} */
        let pathArr = [];
        for ( const f of event.dataTransfer.files )
            pathArr.push(f.path);

        busy(window.ssh.uploadFiles(currentDir, pathArr)
            .then(_ =>
            {
                // Update the file cache with the new files
                getFiles(currentDir).push(...pathArr.map(p =>
                    new RemoteFile(p.substring(p.lastIndexOf('/') + 1), p.substring(0, p.lastIndexOf('/')))));
                loadFileElements();
            }))
    });

    /** Navigate Backward Arrow**/
    document.getElementById('navigate-back')
        .addEventListener('click', () =>
        {
            if ( navigationHistoryIndex > 0 )
            {
                navigationHistoryIndex--;
                navigateTo(navigationHistory[navigationHistoryIndex].from);
            }
        })

    /** Navigate Forward Arrow **/
    document.getElementById('navigate-forward')
        .addEventListener('click', () =>
        {
            if ( navigationHistoryIndex < navigationHistory.length - 1 )
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
    if ( currentUser === undefined )
    {
        let currentSession = window.ssh.sessions.currentSession();
        currentUser = currentSession.username;
        window.setTitle(`SSH Session - ${currentSession.username}@${currentSession.host}:${currentSession.port || 22}`);
    }

    // If for whatever reason currentDir is not defined, return to home menu.
    if ( currentDir === undefined )
    {
        window.location.href = '../index.html';
        return;
    }

    // Remove all previous segments from previous queries
    document.querySelectorAll('.path-arrow, file-element').forEach(e => e.remove());

    let pathContainer = document.querySelector('.path-section');

    let pathSegments = path.dissect(currentDir);

    // Add all the path segments to the path container
    // These are just directories
    for ( let i = 0; i < pathSegments.length; i++ )
    {
        let pathElement = document.createElement('file-element');
        pathElement.setAttribute('name', pathSegments[i]);
        if ( i === 0 )
            pathElement.setAttribute('nick-name', 'root')
        pathElement.setAttribute('path', path.join('/', ...pathSegments.slice(0, i)))
        pathElement.setAttribute('directory', '')
        pathElement.setAttribute('type', 'dir')
        pathElement.setAttribute('path-segment', '')
        pathElement.classList.add('path-separator');

        pathElement.addEventListener('click', () =>
            navigateTo(
                path.join(pathElement.getAttribute('path'), pathElement.getAttribute('name'))
            ))

        /** Directory separator arrow **/
        let arrow = document.createElement('div');
        arrow.classList.add('path-arrow');
        pathContainer.appendChild(arrow);
        pathContainer.appendChild(pathElement);
    }

    // Load all files in the current directory
    loadFileElements();
    assembleFileHierarchy(
        async (path) =>
            await window.ssh.listFiles(path).then(res => res.split('\n')),
        currentDir,
        document.getElementById('file-hierarchy'));
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
    if ( clearOld )
        document.querySelectorAll('file-element:not(.path-separator)')
            .forEach(e => e.remove());

    // Add all files to the file container
    getFiles(path).forEach(file => fileContainer.appendChild(createFileElement(file)));
}

/**
 * Method for navigating to a different directory.
 * @param {string | RemoteFile} target The directory to navigate to.
 */
function navigateTo(target)
{
    if ( target instanceof RemoteFile ) // Convert to viable path
        target = target.path + (target.directory ? '/' + target.name : '')
    // If we're already on there, don't proceed.
    if ( target === currentDir )
        return;

    document.querySelector('.inner-content-container').dataset.path = target;
    // Remove all pop-ups from the screen.
    document.querySelectorAll('.popup').forEach(popup => popup.remove());
    document.querySelector('.file-information').setAttribute('hidden', '');
    console.log("Attempting to navigate to ", target);

    busy(window.ssh
        .listFiles(target) // Retrieve files from selected directory
        .then(result =>
        {
            navigationHistory.push({ from: currentDir, to: target });
            navigationHistoryIndex++
            storeFiles(result, target);
            window.currentDir = target;
            loadFileViewer(); // reload the file viewer
            let pathSection = document.querySelector('.path-section');
            pathSection.scrollLeft = pathSection.scrollWidth;

        })
        .catch(_ =>
        {   // If an error occurs whilst
            window.logger.log('Error occurred whilst attempting to navigate', _)
            // TODO: Add error handling
        }));
}

/**
 * Method for creating a file element.
 * @param {RemoteFile} file The file object to create an element for
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
    if ( file.directory )
        fileElement.setAttribute('directory', '')

    /** File interact functionality **/
    // When one double-clicks on a file, we open it.
    fileElement.addEventListener('dblclick', _ => navigateTo(file));

    // When one clicks on a file, we select it.
    fileElement.addEventListener('click', (event) =>
    {
        // Deselect all other files
        document.querySelectorAll('file-element')
            .forEach(e => e.removeAttribute('selected'))
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
    if ( window.ssh === undefined || currentDir === undefined || !(await window.ssh.connected()) )
        return;

    //
    let cachedFiles = getFiles(currentDir);
    window.ssh.listFiles(currentDir)
        .then(result => result.split('\n'))
        .then(serverFiles =>
        {
            serverFiles = serverFiles.filter(f => f.length > 0);
            // Compare files, if there's any difference, update the file viewer
            if ( cachedFiles.length !== serverFiles.length || cachedFiles.some((file, i) => !serverFiles.includes(file.name)) )
            {
                window.logger.log(`Handling incoming file changes in '${currentDir}' for user '${currentUser}', ${cachedFiles.length} -> ${serverFiles.length}`)
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
    return [ ...document.querySelectorAll('file-element[selected]:not(.path-separator)') ]
}

/**
 * Function for getting all the file elements in the file viewer.
 * @returns {FileElement[]}
 */
function getFileElements()
{
    return [ ...document.querySelectorAll('file-element:not(.path-separator)') ];
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
    if ( status.hasOwnProperty('type') && typeof status.type === 'string' &&
        status.hasOwnProperty('progress') && typeof status.progress === 'number' &&
        status.hasOwnProperty('finished') && typeof status.finished === 'boolean' )
    {
        // Get the target element
        let target = document.getElementById(`pgb-${status.type}`);

        // If the process has finished, we remove the element (if it still exists?)
        if ( status.finished )
            target?.remove();
        else
        {
            if ( target == null )
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
    busy(window.ssh.listFiles(currentDir)
        .then(result =>
        {
            storeFiles(result, currentDir, true);
            loadFileViewer();
        }));
}

/**
 * Function for downloading the currently selected files.
 */
function downloadSelected()
{
    let selectedFiles = getSelectedFiles()
    if ( selectedFiles.length === 0 )
        return;

    busy(Promise.all(selectedFiles.map((element) =>
        window.ssh.downloadFile(element.getAttribute('path'), element.getAttribute('name'))))
        .catch(e => window.logger.error('Error occurred whilst attempting to download file', e)));
}

/**
 * Function for deleting the currently selected files.
 */
function deleteSelected()
{
    let selected = getSelectedFiles();

    // If there aren't any files selected, stop.
    if ( selected.length === 0 )
        return;

    // Cannot delete home or root directory.
    if ( selected.some(e =>
    {
        return e.getAttribute('path') + '/' + e.getAttribute('name') === homeDir
            || e.getAttribute('path') + '/' + e.getAttribute('name') === '/'
    }) )
        return;

    busy(Promise.all(selected.map(e => window.ssh.deleteFile(e.getAttribute('path'), e.getAttribute('name'))))
        .then(_ =>
        {
            fileCache.set(currentDir, getFiles(currentDir).filter(f => !selected.some(e => e.getAttribute('name') === f.name)));
            selected.forEach(e => e.remove());
        })
        .catch(e => window.logger.error('Error occurred whilst attempting to delete file', e)));
}

/**
 * Function for creating a new directory
 */
function createDirectory()
{
    let files = getFiles(currentDir);
    let name = 'New Directory';
    for ( let i = 1; files.find(f => f.name === name); i++ )
        name = `New Directory (${i})`;
    window.ssh.createDirectory(currentDir, name)
        .catch(_ => window.logger.log('Error occurred whilst attempting to create new directory', _));
}

/**
 * Function for uploading files from the local file system to the remote file system.
 */
function addFiles()
{
    window.ssh
        .selectFiles()
        .then(files =>
        {
            if ( files.length < 1 )
                return;
            busy(window.ssh.uploadFiles(currentDir, files)) // TODO: Error handling

        })
}

/**
 *
 */
function cloneSelected()
{
    getSelectedFiles()
        .forEach(fileElement =>
        {
            let file = getFile(selected[0].getAttribute('path'), selected[0].getAttribute('name'));
            if ( file === null )
                return;

        })
}

/**
 * Function for showing the file information of the currently selected file.
 */
async function showFileInfo()
{
    let selected = getSelectedFiles()
    if ( selected.length === 0 )
        return;

    let file = getFile(selected[0].getAttribute('path'), selected[0].getAttribute('name'));
    if ( file === null )
        return;

    if ( !file.loaded )
    {
        busy(await file.loadInfo());
    }

    let fileInfo = document.querySelector('.file-information');
    let clientRect = selected[0].getBoundingClientRect();
    fileInfo.removeAttribute('hidden');

    ensureFrameWithinWindow(fileInfo,
        clientRect.left + clientRect.width / 2 - fileInfo.width / 2,
        clientRect.top + clientRect.height + 10);

    // Copy selected element onto file info page
    document.querySelector('.file-info-preview').style.backgroundImage = `url(${resourceFromFileExtension(selected[0].getAttribute('type'))}`;
    document.getElementById('file-info-perm-user').textContent =
        file.permissions.toString('user') + (currentUser === file.owner ? ' (You)' : '');

    // File permissions for all users, can be (r)ead, (w)rite, and (x)ecute or none.
    document.getElementById('file-info-perm-group')
        .textContent = file.permissions.toString('group');
    document.getElementById('file-info-perm-other')
        .textContent = file.permissions.toString('other');

    document.getElementById('file-info-title')
        .textContent = file.name;

    document.getElementById('file-info-size')
        .textContent = file.fileSizeString;

    document.getElementById('file-info-owner')
        .textContent = file?.owner || 'Unknown';

    document.getElementById('file-info-modified')
        .textContent = file.lastModified || 'Unknown';
}

/**
 * Function for ensuring the provided window stays within boundaries of the window.
 * @param {HTMLElement } frame The frame to ensure within the window.
 * @param {number} nextLeft The next left position of the frame
 * @param {number} nextTop The next top position of the frame
 * @param {{left: number, top: number, right: number, bottom: number}} [margins = {left: 0, top: 0, right: 0, bottom: 0}] The margins to keep from the window edges
 */
function ensureFrameWithinWindow(frame, nextLeft, nextTop, margins = { left: 0, top: 0, right: 0, bottom: 0 })
{
    frame.style.left = Math.max(margins.left, Math.min(window.innerWidth - frame.offsetWidth - margins.right, nextLeft)) + 'px';
    frame.style.top = Math.max(margins.bottom, Math.min(window.innerHeight - frame.offsetHeight - margins.top, nextTop)) + 'px';
}

/**
 * Function for filtering files from the current working directory,
 * and adding them to the file filter results in the search box.
 * @param {Event} [inputEvent] The input event that triggered this function
 */
function manageFileFilteringInput(inputEvent = null)
{
    let inputElement = inputEvent?.target || document.getElementById('file-filter');

    let input = inputElement.value.trim();

    let fileSearchResults = document.getElementById('file-search-results');
    let resultsContainer = document.getElementById('file-filter-results-container');
    fileSearchResults.innerHTML = '';

    if ( input.length === 0 )
    {
        resultsContainer.setAttribute('hidden', '');
        return;
    }
    else
        resultsContainer.removeAttribute('hidden');

    let filteredFiles = getFileElements()
        .filter(e => e.getAttribute('name').toLowerCase().includes(input.toLowerCase()))
        .sort((a, b) => a.getAttribute('name').localeCompare(b.getAttribute('name')));
    filteredFiles
        .forEach(result =>
        {
            let fileSearchResult = document.createElement('file-search-result');
            fileSearchResult.setAttribute('name', result.getAttribute('name'));
            fileSearchResult.setAttribute('path', result.getAttribute('path'));
            fileSearchResult.setAttribute('type', result.getAttribute('type'));
            fileSearchResult.addEventListener('click', () =>
            {
                if ( result.hasAttribute('directory') )
                    navigateTo(
                        path.join(result.getAttribute('path'), result.getAttribute('name'))
                    );
                else
                {
                    result.setAttribute('selected', '');
                    showFileInfo();
                }
            });
            fileSearchResults.appendChild(fileSearchResult);
        })
}