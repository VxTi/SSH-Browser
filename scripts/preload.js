const ipc = require('electron').ipcRenderer;

const pages = {
    login_page: {
        onLoad: loadMain,
        template_path: './pages/login_page.html'
    },
    file_viewer: {
        onLoad: loadFileViewer,
        template_path: './pages/file_viewer.html'
    }
}

ipc.on('exit', () => {
    localStorage['path'] = '';
    localStorage['files'] = ''; 
})

/**
 * Implementing the functionality of the login page.
 */
function loadMain() {
    let [host, username, password] = [
        document.getElementById('ssh-host'),
        document.getElementById('ssh-username'),
        document.getElementById('ssh-password')
    ]

    // Add the login functionality
    document.getElementById('ssh-login').onclick = () => {

        document.querySelector('.login-container').style.visibility = 'hidden';
        document.querySelector('.loading').style.visibility = 'visible';

        // Send a request to log in with the retrieved input.
        ipc.send('attemptLogin', [
            host.value,
            username.value,
            password.value
        ]);
    }
}

/**
 * Loading in the functionality of the file viewer.
 * All files that are loaded are stored in a 'files' variable in local storage.
 * These are then converted into elements visible on the screen.
 * All previously visible files will be removed upon calling this function.
 */
async function loadFileViewer() {

    let files = localStorage['files'].split('\n')
    let path_segments = localStorage['path'].split('/') || [];

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
            if (localStorage['path'] !== directory.dataset.path)
                ipc.send('listFiles', [directory.dataset.path]);
        }
        path_container.appendChild(directory);

        // Add a directory separator
        let arrow = document.createElement('div');
        arrow.classList.add('path-arrow');
        arrow.innerHTML = '';
        path_container.appendChild(arrow);
    }

    let file_container = document.querySelector('.file-container');

    // Add all files to the file container
    for (let file_name of files) {

        // Main file element. Here we add all functionality for whenever a user interacts with it.
        // This can be dragging, opening, moving, etc.
        let file_element = document.createElement('div');
        file_element.classList.add('file');
        file_container.appendChild(file_element);
        file_element.dataset.path = localStorage['path'] + '/' + file_name;
        file_element.dataset.name = formatFileName(file_name, file_element.style.fontSize * file_name.length);
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
                ipc.send(file_name.indexOf('.') > 0 ? 'getFile' : 'listFiles', [file_element.dataset.path]);
        }
    }

    // Add file filtering functionality
    let filter = document.getElementById('file-filter');
    filter.value = ''; // reset previous input
    filter.blur();     // remove focus from the input

    // Add filtering on file name
    filter.oninput = () => {
        let files = document.querySelectorAll('.file');
        for (let file of files) {
            file.classList.toggle('hidden', file.dataset.name.indexOf(filter.value) < 0);
        }
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

/**
 * Hiding the login container when a login attempt is made.
 */
ipc.on('loginAttempt', (event, args) => {
    document.querySelector('.login-container').style.visibility = 'hidden';
    document.querySelector('.loading').visibility = 'visible';
})

/**
 * Handing a failed login attempt and displaying the response message onto the screen.
 */
ipc.on('loginFailed', (event, args) => {
    document.querySelector('.login-container').style.visibility = 'visible';
    document.querySelector('.loading').visibility = 'hidden';
    document.getElementById('error-message').innerHTML = args;
});

/**
 * When a login attempt is successful, redirect the user to the file viewer page and show the files.
 */
ipc.on('loginSuccess', (event, args) => {
    localStorage['path'] = args[0];
    localStorage['files'] = args[1];
    ipc.send('retrieveTemplate', ['fileViewer', pages.file_viewer.template_path]);
})

/**
 * Handling the 'listFiles' event response.
 * Here we change the current path to the path that was provided,
 * and the list of files to the files that were provided.
 * After this, we call 'loadFileViewer', which will load the files onto the screen.
 */
ipc.on("listFilesResponse", (event, args) => {
    localStorage['path'] = args[0];
    localStorage['files'] = args[1];
    loadFileViewer();
});

/**
 * Listener for the 'listFilesError' event.
 * This is fired whenever the event 'listFiles' failed to process.
 */
ipc.on("listFilesError", (event, args) => {

})

/**
 * Handler for the 'retrieveTemplateResponse' event.
 */
ipc.on('retrieveTemplateResponse', (event, args) => showPage(args[0], args[1]));

/**
 * Method for showing a page on the renderer.
 * @param {string} page_identifier The identifier of the page to be shown.
 * @param {string} content The HTML content to show on the page.
 */
function showPage(page_identifier, content) {
    let inner_content = document.querySelector('.inner-content');
    inner_content.innerHTML = content;
    inner_content.dataset.page = page_identifier;
    document.querySelector('.tab-active').dataset.page = page_identifier;
    if (page_identifier in pages)
        pages[page_identifier].onLoad();
}

/**
 * Adding a tab to the tab container.
 * @param {string} title Title of the tab
 * @param {string} page Page identifier
 */
function addTab(title= 'New Page', page= 'login_page') {
    let tab = document.createElement('div');
    tab.classList.add('tab');
    tab.dataset.page = page;
    tab.innerHTML = title;
    if (!document.querySelector('.tab-active'))
        tab.classList.add('tab-active');

    document.querySelector('.add-tab').insertAdjacentElement('beforebegin', tab);

    tab.onclick = () => {
        // Deselect all other tabs
        document.querySelectorAll('.tab-active')
            .forEach((t) => t.classList.remove('tab-active'));

        // Select the currently clicked one
        tab.classList.add('tab-active');

        // Load the content onto the renderer
        ipc.send('retrieveTemplate', [tab.dataset.page, pages[tab.dataset.page].template_path]);
    }
}

/**
 * Event listener for whenever the page loads.
 * This loads before the content of the page actually shows.
 * This content will be loaded in the 'retrieveTemplateResponse' event listener.
 * In this listener we call the 'retrieveTemplate' for the appropriate page
 */
window.addEventListener('DOMContentLoaded', () => {

    addTab();
    let page = document.querySelector('.inner-content').dataset.page;
    if (page in pages) {
        console.log("loading page " + page);
        ipc.send('retrieveTemplate', [page, pages[page].template_path]);
    }

    // Add the 'add page' functionality
    document.querySelector('.add-tab').onclick = addTab;
})