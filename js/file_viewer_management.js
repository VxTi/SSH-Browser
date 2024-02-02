/** @type {Map<string, File[]>} */
const file_map = new Map();
let current_directory = '~';


/**
 * Loading in the files from the provided string.
 * Method parses the provided string into the 'files' object and caches them.
 * @param {string} files The files to be loaded, separated by \n (newline)
 * @param {string} path The path in which the files reside.
 * @param {boolean} load Whether to load the file info or not. Default is false.
 */
function storeFiles(files, path, load = false) {
    file_map.set(path, files.split('\n').map(f => new File(f, path, load)));
}

/**
 * Method for retrieving files from the cache.
 * @param {string} path The path where the files are located at
 * @returns {File[]} Array containing the names of the files
 */
function getFiles(path) {
    return file_map.get(path) || [];
}

/**
 * Method for retrieving a file from the cache.
 * @param {string} path The path where the file is located at
 * @param {string} name The name of the file
 * @returns {File} The file object
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