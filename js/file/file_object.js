/**
 * Class for representing a file on the server.
 * @class File
 */
class File {
    #loaded = false;            // Whether the file info has been loaded
    /** @type FilePermissions */
    #permissions = undefined;   // Permissions of the file, eg 'rwxr-xr-x'
    #owner = 'root';            // Owner of the file
    /** @type String */
    #lastModified = undefined;  // Last modified date of the file
    #fileSize = 0;              // Size of the file in bytes
    #exists = true;             // Whether the file exists on the server
    /** @type HTMLElement */
    #refElement = undefined;    // Reference element of the file
    name;                       // Name of the file

    /**
     * Constructor for the File class.
     * @param {string} fileName Name of the file
     * @param {string} path Path of the file
     * @param {boolean} loadOnCreate Whether to load the file info on creation
     */
    constructor(fileName, path, loadOnCreate = false) {
        this.name = fileName;
        this.path = path;
        this.#permissions = new FilePermissions(this);
        if (loadOnCreate) this.loadInfo();
    }

    /**
     * Method for setting the reference element of the file.
     * @param {HTMLElement} element The reference element
     */
    reference(element) {
        this.#refElement = element;
    }

    /**
     * Getter for file size, in bytes.
     * @returns {number}
     */
    get fileSize() {
        return this.#fileSize;
    }

    /**
     * Returns the file size as a string
     * @returns {string}
     */
    get fileSizeString() {
        let suffixes = ['B', 'KB', 'MB', 'GB', 'TB'];
        for (let i = 0, fs = this.#fileSize; i < suffixes.length; i++) {
            if (fs < 1024)
                return `${fs.toFixed(1)} ${suffixes[i]}`;
            fs /= 1024;
        }
    }

    /**
     * Getter for last modified date.
     * @returns {Date}
     */
    get lastModified() { return this.#lastModified; }

    /**
     * Getter for owner of the file.
     * @returns {string}
     */
    get owner() { return this.#owner; }

    /**
     * Getter for permissions of the file.
     * @returns {FilePermissions}
     */
    get permissions() { return this.#permissions; }

    /**
     * Getter for isDirectory.
     * @returns {boolean}
     */
    get directory() { return this.name.indexOf('.') < 0; }

    /**
     * Getter for whether the file info has loaded.
     * @returns {boolean}
     */
    get loaded() { return this.#loaded; }

    /**
     * Getter for whether the file exists on the server.
     * @returns {boolean}
     */
    get exists() { return this.#exists; }

    /**
     * Method for loading the file info.
     * @param {boolean} force Whether to force load the file info.
     */
    async loadInfo(force = false) {
        // If the data has already been loaded,
        // and we're not forcing a reload, return
        if (this.loaded && !force)
            return;

        // Load the file info
        await window.ssh.getFileInfo(this.path, this.name)
            .then(info => {
                this.#fileSize = info.fileSize;
                this.#lastModified = info.lastModified;
                this.#owner = info.owner;
                this.#permissions.update(info.permissions);
                this.#loaded = true;
            });
    }

    /**
     * Method for deleting the file from the server
     */
    delete() {
        if (!this.exists)
            return;
        window.ssh.deleteFile(this.path, this.name);
        this.#exists = false;
    }

    /**
     * Method for renaming the file on the server
     * @param {string} newName The new name of the file
     */
    rename(newName) {
        if (!this.exists)
            return;
        window.ssh.renameFile(this.path, this.name, newName)
            .then(() => this.name = newName)
    }

}