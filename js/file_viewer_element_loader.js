let busy = (state) => { document.querySelector('.process-loading').style.visibility = state ? 'visible' : 'hidden' }

let currentUser = undefined

let navigateHistory = {
    forward: [],
    backward: []
}

/**
 * Loading in the functionality of the file viewer.
 * All files that are loaded are cached in the 'fileCache' object.
 * These are then converted into elements visible on the screen.
 * All previously visible files will be removed upon calling this function.
 */
function loadFileViewer() {

    if (currentUser === undefined)
        currentUser = window.ssh.sessions.currentSession().username;

    let path_segments = currentDir.split('/') || [];

    // Remove all previous segments from previous queries

    document.querySelectorAll('.path-separator, .path-arrow, .path-separator, .file')
        .forEach(e => e.remove());

    let path_container = document.querySelector('.path-section');

    // Add all the path segments to the path container
    // These are just directories
    for (let i = 0; i < path_segments.length; i++) {
        let seg = path_segments[i];

        /** Path segment element on the bottom of the page **/
        let directory = document.createElement('div');
        directory.classList.add('path-separator');
        directory.dataset.path = path_segments.slice(0, i + 1).join('/');
        directory.innerHTML = seg;

        directory.addEventListener('click', () => {

            // If we click on the path segment, first check whether we're already on that path.
            // If not, load its contents.
            if (currentDir !== directory.dataset.path) {

                busy(true);
                window.ssh
                    .listFiles(directory.dataset.path) // Retrieve files from selected directory
                    .then(result => {
                        storeFiles(result, directory.dataset.path);
                        currentDir = directory.dataset.path;
                        loadFileViewer(); // reload the file viewer
                    })
                    .catch(_ => console.log('Error occurred whilst attempting to navigate', _))
                    .finally(_ => busy(false));
            }
        })
        path_container.appendChild(directory);

        /** Directory separator arrow **/
        let arrow = document.createElement('div');
        arrow.classList.add('path-arrow');
        arrow.innerHTML = '';
        path_container.appendChild(arrow);
    }

    // Clear all previously shown files and show all
    // files in the current working directory.
    loadFileElements(currentDir, true);

    // Add file filtering functionality
    let filter = document.getElementById('file-filter');
    filter.value = ''; // reset previous input
    filter.blur();     // remove focus from the input

    // Add filtering on file name
    filter.addEventListener('input', () => {
        document.querySelectorAll('.file')
            .forEach(file =>
                file.classList.toggle('hidden', file.dataset.name.indexOf(filter.value) < 0));
    })

    /**
     * Functionality for the 'refresh' button in the action bar
     */
    document.getElementById('action-refresh')
        .addEventListener('click', () => {
        busy(true);
        window.ssh.listFiles(currentDir)
            .then(result => {
                storeFiles(result, currentDir, true);
                loadFileViewer();
            }).finally(_ => busy(false));
    });

    /**
     * Functionality for the 'add file' button in the action bar
     */
    document.getElementById('action-add-file')
        .addEventListener('click', () => {

            busy(true);
            window.ssh.selectFiles()
                .then(files => {
                    if (files.length < 1)
                        return;
                    window.ssh.uploadFiles(currentDir, files)
                        .finally(_ => busy(false));

            })
    });

    /**
     * Functionality for the 'delete file' button in the action bar
     */
    document.getElementById('action-delete-file')
        .addEventListener('click', () => {
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
    });


    /** Functionality for the 'home' button */
    document.getElementById('action-home')
        .addEventListener('click', () => {
            busy(true);
            window.ssh.startingDir()
                .then(res => {
                    currentDir = res.path;
                    storeFiles(res.files, currentDir);
                    loadFileViewer();
                })
                .finally(_ => {busy(false)});
        });

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
function loadFileElements(directory = currentDir, clearOld = true, indent = 0, insertAfter = null) {

    // remove all old files if
    if (clearOld)
        document.querySelectorAll('.file').forEach(e => e.remove());

    let fileContainer = document.querySelector('.file-container');

    let files = getFiles(directory);

    fileContainer.classList.add('file-view-icons');

    // Add all files to the file container
    files.forEach(file => fileContainer.appendChild(createFileElement(file)));

    // When the user clicks, hide the context menu.
    document.addEventListener('click', () => {
        document.querySelector('.context-menu').classList.remove('active');
    })

    // When a user double-clicks on the document, we deselect all files and hide the file information.
    document.addEventListener('dblclick', () => {
        document.querySelector('.file-information').classList.toggle('hidden', true);
        document.querySelectorAll('.file.selected').forEach(e => e.classList.remove('selected'));
    })

    /** Context menu - Right-clicking*/
    document.addEventListener('contextmenu', async (event) => {
        if (!document.hasFocus())
            return;
        event.preventDefault();
        event.stopImmediatePropagation();

        // Select potential file
        let file = event.target.parentElement;
        let isFile = file.classList.contains('file');
        let hasClipboard = await navigator.clipboard.readText().then(text => text.length > 0);
        if (isFile)
            file.classList.add('selected');

        document.querySelectorAll(`#context-menu-rename, #context-menu-delete, #context-menu-download, #context-menu-cut, #context-menu-copy ${hasClipboard ? '' : ', #context-menu-paste'}`)
            .forEach(e => e.classList.toggle('disabled', !isFile));

        let menu = document.querySelector('.context-menu');
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';
        menu.classList.add('active');
    });
}

/**
 * Method for creating a file element.
 * @param {File} file The file object to create an element for
 * @returns {HTMLDivElement} The file element created
 */
function createFileElement(file) {
    // Main file element. Here we add all functionality for whenever a user interacts with it.
    // This can be dragging, opening, moving, etc.

    let executables = ['exe', 'sh', 'bat', 'dylib', 'so'];
    let isExecutable = executables.indexOf(file.name.substring(file.name.lastIndexOf('.') + 1)) >= 0;

    let fileElement = document.createElement('div');
    fileElement.classList.add('file', 'r-icons', file.directory ? 'directory' : 'ordinary');
    fileElement.dataset.path = file.path;
    fileElement.dataset.name = file.name;
    fileElement.draggable = true;
    file.reference(fileElement);


    let fileIcon = document.createElement('div');
    fileIcon.classList.add('file-icon', file.directory ? 'file-directory' : isExecutable ? 'file-executable' :
        file.name.endsWith('.css') ? 'file-css' :
            file.name.endsWith('.html') ? 'file-html' :
                file.name.endsWith('.js') ? 'file-js' :
                    file.name.endsWith('.json') ? 'file-json' :
                        file.name.endsWith('.md') ? 'file-md' : 'file-ordinary');
    fileElement.appendChild(fileIcon);

    // Add the file name to the file element
    let fileTitle = document.createElement('span');
    fileTitle.classList.add('file-name');
    fileTitle.innerHTML = formatFileName(file.name)  ;
    fileElement.appendChild(fileTitle);

    /** File interact functionality **/

    // When one double-clicks on a file, we open it.
    fileElement.addEventListener('dblclick', () => {

        // If it's a directory, we open it.
        if (file.directory) {
            window.ssh.listFiles(file.path + '/' + file.name)
                .then(result => {
                    storeFiles(result, file.path + '/' + file.name);
                    currentDir = file.path + '/' + file.name;
                    loadFileViewer(); // reload the file viewer
                });
        }
    });

    // When one clicks on a file, we select it.
    // If we're in column view, we open the directory.
    fileElement.addEventListener('click',  (event) => {

        // Deselect all other files
        document.querySelectorAll('.file').forEach(e => e.classList.remove('selected'));

        document.querySelector('.context-menu').classList.remove('active');

        fileElement.classList.add('selected');
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

    document.querySelector('.file-information').classList.toggle('hidden', files.length <= 0)

    if (files.length === 0)
        return;

    if (files.length > 1) {
        // TODO: Add implementation for multiple files
    } else { // Single file

        let preview = document.querySelector('.file-info-preview');
        let isDir = files[0].indexOf('.') < 0;
        let executables = ['exe', 'sh', 'bat', 'dylib', 'so', 'jar'];
        let isExecutable = executables.indexOf(files[0].substring(files[0].lastIndexOf('.') + 1)) >= 0;

        // TODO: Fix this
        preview.classList.toggle(isDir ? 'file-directory' : isExecutable ? 'file-executable' : 'file-ordinary', true);

        (async () => {
            // If there's only one file, we can show all information about it.
            let file = getFile(directory, files[0]);
            if (!file.loaded) {
                busy(true);
                await file.loadInfo().finally(_ => busy(false)); // Load file info
            }

            /** Show file info **/
            document.getElementById('file-info-permissions-values').innerHTML = file.permissions.toString(currentUser, (input) => {
                console.log(input)
                return input.map(e => `<span class="f-perm-${e.toLowerCase()}">${e}</span>`).join('<span>/</span>');
            });

            document.getElementById('file-info-title').innerText = file.name;
            document.getElementById('file-info-size').innerText = file.fileSizeString;
            document.getElementById('file-info-owner').innerText = file?.owner || 'Unknown';
            document.getElementById('file-info-modified').innerText = file.lastModified || 'Unknown';
        })();
    }
}