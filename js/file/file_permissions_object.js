/**
 * File permissions object.
 */
class FilePermissions {

    /** @type string */
    #permissions;
    /** @type File */
    #file;

    /**
     * Constructor for file permissions.
     * @param {File} file The file object
     * @param {string} permissions File permissions, in the form of rwxrwxrwx (Linux/Unix format)
     */
    constructor(file, permissions= '---------' ) {
        this.update(permissions);
        this.#file = file;
    }

    /**
     * Updates the permissions of the file.
     * @param permissions
     */
    update(permissions) {
        if (/([rwx-]{9}@?)/.test(permissions))
            this.#permissions = permissions;
        else throw new Error('Invalid permissions format');
    }

    /**
     * Getter for the permissions of the file.
     * @returns {string} Permissions in 'rwxrwxrwx' format
     */
    get permissions() {
        return this.#permissions;
    }

    /**
     * Returns the string representation of the permissions.
     * @param {string} accessor Who to check the permissions for
     * @param {function} formatFn Function to format the permissions
     * @returns {string}
     */
    toString(accessor, formatFn = null) {
        let readIndex = this.#file.owner === accessor ? 0 : 1;
        let perms = [];
        for (let i = 0; i < 3; i++) {
            let permission = this.#permissions[i + 3 * readIndex];
            if (permission === 'r')
                perms.push('Read');
            if (permission === 'w')
                perms.push('Write');
            if (permission === 'x')
                perms.push('Execute');
        }
        if (typeof formatFn === 'function')
            return formatFn(perms);
        return perms.length === 0 ? 'None' : perms.join('/');
    }
}