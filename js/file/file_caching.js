/** @type {Map<string, File[]>} */
const fileCache = new Map();
let currentDir = '~';


/**
 * Loading in the files from the provided string.
 * Method parses the provided string into the 'files' object and caches them.
 * @param {string | string[]} files The files to be loaded, separated by \n (newline)
 * @param {string} path The path in which the files reside.
 * @param {boolean} forceLoad Whether to reload the content of the provided path or not. Default is false.
 * @param {boolean} loadFileInfo Whether to load the file info or not. Default is false.
 */
function storeFiles(files, path, forceLoad = false, loadFileInfo = false) {
    if (files === undefined || path === undefined || files.length === 0)
        return;

    // Convert 'files' parameter to an array if it isn't one already.
    files = Array.isArray(files) ? files : files.split('\n');

    // If the path is already loaded in the file map, we'll check whether we have to add new files or not.
    if (fileCache.has(path) && !forceLoad) {

        let filesToAdd = files.filter(f => !fileCache.get(path).find(f2 => f2.name === f));
        if (filesToAdd.length > 0)
            fileCache.get(path).push(...filesToAdd.map(fileName => new File(fileName, path, loadFileInfo)));

    } else {
        // If the path is not loaded in the file map, we'll add the files to the map.
        fileCache.set(path, files.map(fileName => new File(fileName, path, loadFileInfo)));
    }
}

/**
 * Method for retrieving files from the cache.
 * @param {string} path The path where the files are located at
 * @returns {File[]} Array containing the names of the files
 */
function getFiles(path) {
    return fileCache.get(path) || [];
}

/**
 * Method for retrieving a file from the cache.
 * @param {string} path The path where the file is located at
 * @param {string} name The name of the file
 * @returns {File} The file object
 */
function getFile(path, name) {
    return fileCache.get(path)?.find(f => f.name === name) || null
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