const ipc = require('electron').ipcRenderer;

const pages = {
    login_page: {
        onLoad: loadMain,
        template_path: 'pages/login_page.html'
    },
    file_viewer: {
        onLoad: loadFileViewer,
        template_path: 'pages/file_viewer.html'
    }
}

const sessions = {};
const file_map = new Map();
let current_directory = '';

/**
 * Implementing the functionality of the login page.
 */
function loadMain() {
    let [host, username, password] = [
        document.getElementById('ssh-host'),
        document.getElementById('ssh-username'),
        document.getElementById('ssh-password')
    ];

    // Add the login functionality
    document.getElementById('ssh-login').onclick = () => {

        document.querySelector('.login-container').style.visibility = 'hidden';
        document.querySelector('.loading').style.visibility = 'visible';

        // Send a request to log in with the retrieved input.
        ipc.send('connect', [host.value, username.value, password.value]);
    }
}

ipc.on('connection-response', (event, authResponse) => {

    // If the authentication was successful, load the file viewer.
    if (authResponse[0]) {

        current_directory = ipc.sendSync('listDirectory');
        loadFiles(ipc.sendSync('listFiles', [current_directory]), current_directory);
        showPage('file_viewer');
    } else {
        document.querySelector('.login-container').style.visibility = 'visible';
        document.querySelector('.loading').style.visibility = 'hidden';
        document.querySelector('.error-message').innerHTML = authResponse[1];
    }
})

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
                loadFiles(ipc.sendSync('listFiles', [file_element.dataset.path]), file_element.dataset.path);
                current_directory = file_element.dataset.path;
                loadFileViewer(); // reload the file viewer
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
                loadFiles(ipc.sendSync('listFiles', [directory.dataset.path]), directory.dataset.path);
                current_directory = directory.dataset.path;
                loadFileViewer(); // reload the file viewer
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

    document.getElementById('action-add-file').onclick = () => ipc.send('open-files');
    document.getElementById('action-delete-file').onclick = () => {
        let selected = document.querySelector('.file.selected');
        if (!selected)
            return;

        ipc.send('delete-file', [current_directory, selected.dataset.path]);
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

        ipc.send('upload-files', [current_directory, pathArr]);
    });
}

ipc.on('delete-file-response', (event, args) => {
    if (args[0]) {
        console.log("Deleted file successfully.");
        file_map.set(current_directory, ipc.sendSync('listFiles', [current_directory]));
        loadFileElements();
    } else {
        console.error(" --- Could not delete file --- ")
        console.error(args[1]);
    }
})

/**
 * Event handler for responding to a 'upload-files-response' event.
 */
ipc.on('upload-files-response', (event, args) => {
    if (args[0]) {
        console.log('file_map before: ', file_map);
        file_map.set(current_directory, ipc.sendSync('listFiles', [current_directory]));
        console.log('file_map after: ', file_map);
        loadFileElements();
    } else {
        console.error(" --- Could not upload files --- ")
        console.error(args[1]);
    }
})

/**
 * Event handler for responding to a 'select-files' event.
 * If we've selected files with the 'add file' button, we first have to check
 * whether there's an active connection with the current SSH session.
 * If this is the case, we can upload them.
 */
ipc.on('open-files-response', (event, args) => {
    // Check whether we're connected with SSH
    if (ipc.sendSync('connection-status')) {

        // If so, upload the selected files.
        ipc.send('upload-files', [current_directory, args]);
    }
});

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

/**
 * Method for showing a page on the renderer.
 * @param {string} page_identifier The identifier of the page to be shown.
 */
function showPage(page_identifier) {

    // Check whether the page identifier exists in the pages object.
    if (!page_identifier in pages)
        return;

    let inner_content = document.querySelector('.inner-content');
    inner_content.innerHTML = ipc.sendSync('retrieveTemplate', [pages[page_identifier].template_path]);
    inner_content.dataset.page = page_identifier;
    document.querySelector('.tab-active').dataset.page = page_identifier;

    if (page_identifier in pages)
        pages[page_identifier].onLoad();
}

/**
 * Adding a tab to the tab container.
 * @param {string} title Title of the tab
 * @param {string} page_identifier Page identifier
 * @returns {Element} The tab element that has been created.
 */
function addTab(title= 'New Page', page_identifier= 'login_page') {
    let tab = document.createElement('div');
    tab.classList.add('tab');
    tab.dataset.page = page_identifier;
    tab.innerHTML = title;
    if (!document.querySelector('.tab-active'))
        tab.classList.add('tab-active');

    document.querySelector('.add-tab').insertAdjacentElement('beforebegin', tab);

    tab.onclick = () => openTab(tab);
    return tab;
}

/**
 * Method for opening a tab, given a provided tab element.
 * @param {HTMLElement} tab The tab element to be opened.
 */
function openTab(tab) {
    // Check whether the provided element is actually a tab, if not, don't proceed
    if (!tab.classList.contains('tab'))
        return;

    // Deselect all previously selected tabs
    document.querySelectorAll('.tab-active')
        .forEach((t) => t.classList.remove('tab-active'));

    // Select the currently clicked one
    tab.classList.add('tab-active');
    showPage(tab.dataset.page);
}

/**
 * Event listener for whenever the page loads.
 * This loads before the content of the page actually shows.
 * This content will be loaded in the 'retrieveTemplateResponse' event listener.
 * In this listener we call the 'retrieveTemplate' for the appropriate page
 */
window.addEventListener('DOMContentLoaded', () => {

    addTab(); // Start with one tab
    showPage(document.querySelector('.inner-content').dataset.page); // Show the current page

    document.onkeydown = (key) => {
        console.log(key);
        if (key.ctrlKey) switch (key.key) {
            case 'w':
                // Check whether there's more than one tabs open.
                // If this is not the case, don't go any further.
                if (document.querySelectorAll('.tab').length <= 1)
                    return;

                let tabToRemove = document.querySelector('.tab-active');
                openTab(tabToRemove.previousElementSibling || tabToRemove.nextElementSibling);
                tabToRemove.remove();
                key.preventDefault();
                key.stopImmediatePropagation();
                break;
            case 't': openTab(addTab()); break;
        }
    }


    // Add the 'add page' functionality
    document.querySelector('.add-tab').onclick = () => addTab();
})