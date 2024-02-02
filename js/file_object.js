class File {
    #loaded = false;
    #permissions = undefined;
    #owner = 'root';
    #lastModified = undefined;
    #fileSize = 0;
    #exists = true;
    #refElement = undefined;

    constructor(fileName, path) {
        this.fileName = fileName;
        this.path = path;
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
        for (let i = 0; i < suffixes.length; i++) {
            if (this.#fileSize < 1024)
                return `${this.#fileSize.toFixed(2)} ${suffixes[i]}`;

            this.#fileSize /= 1024;
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
     * @returns {string}
     */
    get permissions() { return this.#permissions; }

    /**
     * Getter for isDirectory.
     * @returns {boolean}
     */
    get directory() { return this.fileName.indexOf('.') < 0; }

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
    load(force = false) {
        if (this.loaded && !force)
            return;

        window.ssh.getFileInfo(this.path, this.fileName)
            .then(info => {
                this.#fileSize = info.fileSize;
                this.#lastModified = info.lastModified;
                this.#owner = info.owner;
                this.#permissions = info.permissions;
                this.#loaded = true;
            });
    }

    /**
     * Method for deleting the file from the server
     */
    delete() {
        if (!this.exists)
            return;
        window.ssh.deleteFile(this.path, this.fileName);
        this.#exists = false;
    }

    /**
     * Method for renaming the file on the server
     * @param {string} newName The new name of the file
     */
    rename(newName) {
        if (!this.exists)
            return;
        window.ssh.renameFile(this.path, this.fileName, newName)
            .then(() => this.fileName = newName)
    }

}