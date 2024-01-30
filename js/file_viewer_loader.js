// Map containing paths with arrays of files
const file_map = new Map();
let current_directory = '';


/**
 * Loading in the files from the provided string.
 * Method parses the provided string into the 'files' object and caches them.
 * This makes it easier to traverse back and forth.
 * Parameter must be in format 'file1\nfile2\n ...'
 * @param {string} files The files to be loaded.
 * @param {string} path The path in which the files reside. Example: '/home/user', put in /user/
 */
function storeFiles(files, path) {
    file_map.set(path, files.split('\n'));
}

/**
 * Method for retrieving files from the cache.
 * @param {string} path The path where the files are located at
 * @returns {string[]} Array containing the names of the files
 */
function getFiles(path) {
    return file_map.get(path) || [];
}

/**
 * Method for checking if the cache contains the path
 * @param path
 */
function hasFile(path) {
    return file_map.has(path);
}

let busy = (state) => { document.querySelector('.process-loading').style.visibility = state ? 'visible' : 'hidden' }

/**
 * Loading in the functionality of the file viewer.
 * All files that are loaded are stored in a 'files' variable in local storage.
 * These are then converted into elements visible on the screen.
 * All previously visible files will be removed upon calling this function.
 */
function loadFileViewer() {

    let path_segments = current_directory.split('/') || [];

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
            // If it's the same directory, we don't have to perform another query.
            if (current_directory !== directory.dataset.path) {
                window.ssh
                    .listFiles(directory.dataset.path)
                    .then(result => {
                        storeFiles(result, directory.dataset.path);
                        current_directory = directory.dataset.path;
                        loadFileViewer(); // reload the file viewer
                    });
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
    loadFileElements(current_directory, true);

    // Add file filtering functionality
    let filter = document.getElementById('file-filter');
    filter.value = ''; // reset previous input
    filter.blur();     // remove focus from the input

    // Add filtering on file name
    filter.addEventListener('input', () => {
        document.querySelectorAll('.file')
            .forEach(file =>
                file.classList.toggle('hidden', file.dataset.path.indexOf(filter.value) < 0));
    })

    /**
     * Functionality for the 'refresh' button in the action bar
     */
    document.getElementById('action-refresh')
        .addEventListener('click', () => {
        busy(true);
        window.ssh.listFiles(current_directory)
            .then(result => {
                storeFiles(result, current_directory);
                loadFileViewer();
            }).finally(_ => busy(false));
    });

    /**
     * Functionality for the 'add file' button in the action bar
     */
    document.getElementById('action-add-file')
        .addEventListener('click', () => {
        window.ssh.selectFiles()
            .then(files => {
                if (files.length > 0)
                    busy(true);
                window.ssh.upload(current_directory, files)
                    .then(_ => {
                        console.log(files);
                    }).finally(_ => busy(false));
            })
    });

    /**
     * Functionality for the 'delete file' button in the action bar
     */
    document.getElementById('action-delete-file')
        .addEventListener('click', () => {
        let selected = document.querySelector('.file.selected');
        if (!selected)
            return;
        busy(true);
        window.ssh.deleteFile(current_directory, selected.dataset.path).then(_ => {
            selected.remove() // remove from elements

            let files = getFiles(current_directory);
            files.splice(files.indexOf(selected.dataset.name), 1);
            storeFiles(current_directory, files.join('\n'));
        }).finally(_ => busy(false));
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

    document.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        let pathArr = [];
        for (const f of event.dataTransfer.files)
            pathArr.push(f.path);

        busy(true);
        window.ssh.uploadFile(current_directory, pathArr)
            .then(_ => {
                let newFiles = pathArr.map(p => p.substring(p.lastIndexOf('/') + 1)).join('\n');
                storeFiles(current_directory, file_map.get(current_directory) + '\n' + newFiles);
                loadFileElements(current_directory, true);
            })
            .finally(_ => busy(false));
    });
}

/**
 * Method for loading all files in the currently selected directory.
 * This method converts the files in 'file_map[current_directory]' into elements.
 */
function loadFileElements(directory = current_directory, clearOld = true, indent = 0, insertAfter = null) {

    // remove all old files if
    if (clearOld)
        document.querySelectorAll('.file').forEach(e => e.remove());

    let file_container = document.querySelector('.file-container');

    let files = getFiles(directory);

    let columns = document.querySelector('.file-container').dataset.viewType === 'columns';

    file_container.classList.add(columns ? 'file-view-column' : 'file-view-icons');

    // Add all files to the file container
    for (let file_name of files) {
        if (file_name.length === 0)
            continue;
        let element = createFileElement(directory, file_name, columns, indent);
        if (insertAfter === null)
            file_container.appendChild(element);
        else
            file_container.insertBefore(element, insertAfter.nextSibling);
    }
}

function createFileElement(directory, file_name, columns = false, indent = 0) {
    // Main file element. Here we add all functionality for whenever a user interacts with it.
    // This can be dragging, opening, moving, etc.

    let executables = ['exe', 'sh', 'bat', 'dylib', 'so', 'jar'];
    let isExecutable = executables.indexOf(file_name.substring(file_name.lastIndexOf('.') + 1)) >= 0;
    let isDirectory = file_name.indexOf('.') < 0;

    let file_element = document.createElement('div');
    file_element.classList.add('file', columns ? 'r-columns' : 'r-icons', isDirectory ? 'directory' : 'ordinary');
    file_element.dataset.path = directory + '/' + file_name;
    file_element.dataset.name = file_name;
    file_element.draggable = true;
    file_element.style.setProperty('--indent', indent);


    let file_icon = document.createElement('div');
    file_icon.classList.add('file-icon', isDirectory ? 'file-directory' : isExecutable ? 'file-executable' : 'file-ordinary');
    file_element.appendChild(file_icon);

    // Add the file name to the file element
    let file_name_element = document.createElement('span');
    file_name_element.classList.add('file-name');
    file_name_element.innerHTML = formatFileName(file_name)  ;
    file_element.appendChild(file_name_element);

    /** File interact functionality **/

    // When one double-clicks on a file, we open it.
    file_element.addEventListener('dblclick', () => {

        // If it's a directory, and we're in Icon view, we open it.
        // If we're in column view, double-clicking doesn't do anything.
        if (file_element.classList.contains('directory') && !columns) {
            window.ssh.listFiles(file_element.dataset.path)
                .then(result => {
                    storeFiles(result, file_element.dataset.path);
                    current_directory = file_element.dataset.path;
                    loadFileViewer(); // reload the file viewer
                });
        }
    });

    // When one clicks on a file, we select it.
    // If we're in column view, we open the directory.
    file_element.addEventListener('click',  (event) => {

        // Deselect all other files
        document.querySelectorAll('.file').forEach(e => e.classList.remove('selected'));

        // Check if we're in column view, and if we're clicking on a directory.
        // If so, we open it and show its child files.
        if (columns && file_element.classList.contains('directory')) {
            file_element.classList.add('open');

            // If we're in column view and one clicks on a directory, we want to
            // expand it and show all containing files.
            // If the files haven't been loaded in the file map yet, we'll have to retrieve them.
            if (!hasFile(file_element.dataset.path)) {

                // Retrieve files from the server
                window.ssh.listFiles(file_element.dataset.path)
                    .then(result => {
                        storeFiles(result, file_element.dataset.path);
                        loadFileElements(file_element.dataset.path, false, ++indent, file_element);
                    });
            } else {
                // If the files have been loaded in the file map, we can just load them in.
                loadFileElements(file_element.dataset.path, false, ++indent, file_element);
            }
        }

        file_element.classList.add('selected');
        selectFiles([file_name], directory);

        event.preventDefault();
        event.stopImmediatePropagation();
    })

    return file_element;
}



/**
 * Function for selecting a file
 * @param {string} directory The directory in which the file resides.
 * @param {string[]} files The file(s) to select, separated by a newline.
 * This also shows all information in the 'file-information' section.
 */
function selectFiles(files, directory = current_directory) {

    document.querySelector('.file-information').style.visibility = files.length > 0 ? 'visible' : 'hidden';
    if (files.length === 1) {
        let preview = document.querySelector('.file-info-preview');
        let isDir = files[0].indexOf('.') < 0;
        let executables = ['exe', 'sh', 'bat', 'dylib', 'so', 'jar'];
        let isExecutable = executables.indexOf(files[0].substring(files[0].lastIndexOf('.') + 1)) >= 0;

        preview.classList.toggle(isDir ? 'file-directory' : isExecutable ? 'file-executable' : 'file-ordinary', true);
    }

    if (files.length === 0)
        return;

    if (files.length > 1) {
        // TODO: Add implementation for multiple files
    } else {

        busy(true);
        window.ssh.getFileInfo(directory, files[0])
            .then(result => {
                console.log(result);
                let details = result.split(' ');
                let fileSize = parseInt(details[4]);

                let permissions = []
                let checkIndex = details[2] === window.ssh.sessions.currentSession().username ? 0 : 1;
                for (let i = 0; i < 3; i++) {
                    if (details[checkIndex][i] === 'r') permissions.push('Read');
                    if (details[checkIndex][i] === 'w') permissions.push('Write');
                    if (details[checkIndex][i] === 'x') permissions.push('Execute');
                }
                if (permissions.length === 0) permissions.push('None');
                document.getElementById('file-info-permissions').innerText = permissions.join(' / ');

                document.getElementById('file-info-title').innerText = files[0];
                document.getElementById('file-info-size').innerText =
                    fileSize > (1024 * 1024) ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB` :
                        fileSize > 1024 ? `${(fileSize / 1024).toFixed(2)} KB` : `${fileSize} B`;
                document.getElementById('file-info-owner').innerText = details[2];
                document.getElementById('file-info-modified').innerText = `${details[6]} ${details[5]} ${details[7]}`;
            })
            .finally(_ => busy(false));
    }
}

/**
 * Method for formatting file names.
 * This is used for when file names are too long to be displayed on the screen.
 * @param {string} name The name of the file to be formatted.
 * @param {number} maxLength The maximum length of the file name. Default is 20.
 */
function formatFileName(name, maxLength= 14) {
    if (name.length > maxLength) {
        let extensionIndex = name.indexOf('.');
        if (extensionIndex < 0) // Directory
            return name.substring(0, maxLength - 3) + '...';

        return name.substring(0, maxLength / 2) + '...' + name.substring(maxLength / 2);
    }
    return name;
}