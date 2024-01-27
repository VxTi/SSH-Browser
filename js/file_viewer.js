const file_map = new Map();
let current_directory = '';



/**
 * Loading in the files from the provided string.
 * Method parses the provided string into the 'files' object and caches them.
 * This makes it easier to traverse back and forth.
 * Parameter must be in format 'file1\nfile2\n ...'
 * @param {string} files The files to be loaded.
 * @param {string} directory The directory in which the files reside.
 */
function loadFiles(files, directory) {
    file_map.set(directory, files);
}

let busy = (state) => { document.querySelector('.process-loading').style.visibility = state ? 'visible' : 'hidden' }

/**
 * Method for loading all files in the currently selected directory.
 * This method converts the files in 'file_map[current_directory]' into elements.
 */
function loadFileElements() {

    // Remove all previous files
    for (let e of document.querySelectorAll('.file'))
        e.remove();

    let file_container = document.querySelector('.file-container');

    let files = file_map.get(current_directory)?.split('\n') || [];

    // Add all files to the file container
    for (let file_name of files) {
        if (file_name.length === 0)
            continue;

        // Main file element. Here we add all functionality for whenever a user interacts with it.
        // This can be dragging, opening, moving, etc.
        let file_element = document.createElement('div');
        file_element.classList.add('file');
        file_container.appendChild(file_element);
        file_element.dataset.path = current_directory + '/' + file_name;
        file_element.dataset.name = file_name;
        file_element.draggable = true;

        // Add the file name to the file element
        let file_name_element = document.createElement('span');
        file_element.classList.add(file_name.indexOf('.') > 0 ? 'file-ordinary' : 'file-directory');
        file_name_element.classList.add('file-name');
        file_name_element.innerHTML = formatFileName(file_name)  ;
        file_element.appendChild(file_name_element);

        // Whenever someone clicks on the file, check whether it's selected or not.
        // If it's not selected, select it. If it is selected, open the file.
        file_element.onclick = () => {
            for (let element of document.querySelectorAll('.file'))
                if (element !== file_element) element.classList.remove('selected');

            if (!file_element.classList.contains('selected'))
                file_element.classList.add('selected');
            else  // Open the file or folder if selected
            {
                if (file_element.classList.contains('file-directory')) { // Directory
                    window.ssh.listFiles(file_element.dataset.path)
                        .then(result => {
                            loadFiles(result, file_element.dataset.path);
                            current_directory = file_element.dataset.path;
                            loadFileViewer(); // reload the file viewer
                        });
                }
            }
        }
    }
}

/**
 * Loading in the functionality of the file viewer.
 * All files that are loaded are stored in a 'files' variable in local storage.
 * These are then converted into elements visible on the screen.
 * All previously visible files will be removed upon calling this function.
 */
async function loadFileViewer() {

    let path_segments = current_directory.split('/') || [];

    // Remove all previous segments from previous queries
    for (let dir of document.querySelectorAll('.path-separator, .path-arrow, .path-separator, .file'))
        dir.remove();

    let path_container = document.querySelector('.path-section');

    // Add all the path segments to the path container
    // These are just directories
    for (let i = 0; i < path_segments.length; i++) {
        let seg = path_segments[i];
        let directory = document.createElement('div');
        directory.classList.add('path-separator');
        directory.dataset.path = path_segments.slice(0, i + 1).join('/');
        directory.innerHTML = seg;
        directory.onclick = () => {
            // If it's the same directory, we don't have to perform another query.
            if (current_directory !== directory.dataset.path) {
                window.ssh.listFiles(directory.dataset.path)
                    .then(result => {
                        loadFiles(result, directory.dataset.path);
                        current_directory = directory.dataset.path;
                        loadFileViewer(); // reload the file viewer
                    });
            }
        }
        path_container.appendChild(directory);

        // Add a directory separator
        let arrow = document.createElement('div');
        arrow.classList.add('path-arrow');
        arrow.innerHTML = '';
        path_container.appendChild(arrow);
    }

    loadFileElements();

    // Add file filtering functionality
    let filter = document.getElementById('file-filter');
    filter.value = ''; // reset previous input
    filter.blur();     // remove focus from the input

    // Add filtering on file name
    filter.oninput = () => {
        let files = document.querySelectorAll('.file');
        for (let file of files) {
            file.classList.toggle('hidden', file.dataset.path.indexOf(filter.value) < 0);
        }
    }

    document.getElementById('action-add-file').onclick = () => {
        window.ssh.selectFiles()
            .then(files => {
                if (files.length > 0)
                    busy(true);
                    window.ssh.upload(current_directory, files)
                        .then(_ => {
                            console.log(files);
                        }).finally(_ => busy(false));
            })
    }
    document.getElementById('action-delete-file').onclick = () => {
        let selected = document.querySelector('.file.selected');
        if (!selected)
            return;
        busy(true);
        window.ssh.deleteFile(current_directory, selected.dataset.path).then(_ => {
            selected.remove() // remove from elements
            let files = file_map.get(current_directory).split('\n');
            files.splice(files.indexOf(selected.dataset.name), 1);
            file_map.set(current_directory, files.join('\n'));
        }).finally(_ => busy(false));
    }

    // Add keyboard functionality.
    // Example, moving through files with arrow keys,
    // Deleting files, etc.
    document.onkeydown = (e) => {
        let selected = document.querySelector('.file.selected');
        if (!selected)
            return;

        if (e.key === 'ArrowLeft') {
            let prev = selected.previousElementSibling;
            if (prev) {
                selected.classList.remove('selected');
                prev.classList.add('selected');
            }
        } else if (e.key === 'ArrowRight') {
            let next = selected.nextElementSibling;
            if (next) {
                selected.classList.remove('selected');
                next.classList.add('selected');
            }
        }
    };
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
                file_map.set(current_directory, file_map.get(current_directory) + '\n' + newFiles);
                loadFileElements();
            })
            .finally(_ => busy(false));
    });
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
document.addEventListener('DOMContentLoaded', async () => {
    // Load the files from the current directory
    addLoadingSpinner(document.querySelector('.process-loading'));
    document.getElementById('back-main').onclick = () => window.location.href = '../index.html'
    busy(true);
    window.ssh.currentDirectory()
        .then(dir => window.ssh.listFiles(dir)
            .then(result => {
                current_directory = dir;
                loadFiles(result, dir);
                loadFileViewer();
            })
            .finally(_ => busy(false))
        ).finally(_ => busy(false));
})