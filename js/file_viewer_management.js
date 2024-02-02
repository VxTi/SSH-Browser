// Map containing paths with arrays of files
/** @type {Map<string,
 * {fileName: string, path: string, isDirectory: boolean,
 *  lastModified: string, permissions: string,
 *  owner: string, fileSize: number}[]>} */
const file_map = new Map();
let current_directory = '';


/**
 * Loading in the files from the provided string.
 * Method parses the provided string into the 'files' object and caches them.
 * This makes it easier to traverse back and forth.
 * Parameter must be in format 'file1\nfile2\n ...'
 * @param {string} files The files to be loaded, separated by \n
 * @param {string} path The path in which the files reside. Example: '/home/user', put in /user/
 */
function storeFiles(files, path) {
    file_map.set(path, files.split('\n').map(f => {
        return {
            fileName: f,
            path: path,
            fileSize: 0,
            lastModified: undefined,
            owner: 'root',
            isDirectory: f.indexOf('.') < 0,
            permissions: undefined
        };
    }));
}

/**
 * Loading file info into the file map
 * @param {string} path Directory where the file resides in
 * @param {string} fileName Name of the file
 * @returns {Promise<Object>}
 */
async function loadFileInfo(path, fileName) {
    window.ssh.getFileInfo(path, fileName)
        .then(info => {
            let file = file_map.get(path).find(f => f.fileName === fileName);
            file.fileSize = info.fileSize;
            file.lastModified = info.lastModified;
            file.owner = info.owner;
            file.permissions = info.permissions;
        })
}

/**
 * Method for retrieving files from the cache.
 * @param {string} path The path where the files are located at
 * @returns {Object[]} Array containing the names of the files
 */
function getFiles(path) {
    return file_map.get(path) || [];
}

/**
 * Method for retrieving a file from the cache.
 * @param {string} path The path where the file is located at
 * @param {string} name The name of the file
 * @returns {{fileName: string, path: string, isDirectory: boolean, permissions: string}} The file object
 */
function getFile(path, name) {
    return file_map.get(path).find(f => f.fileName === name);
}

/**
 * Method for retrieving file names from the cache.
 * @param {string} path The path where the files are located at
 * @returns {string[]} Array containing the names of the files
 */
function getFileNames(path) {
    return file_map.get(path)?.map(f => f.fileName) || [];
}

/**
 * Method for checking if the cache contains the path
 * @param path
 */
function hasFile(path) {
    return file_map.has(path);
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