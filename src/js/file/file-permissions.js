/**
 * File permissions object.
 */
export class FilePermissions {

    /** @type string */
    #permissions;
    /** @type SSHFile */
    #file;

    /**
     * Constructor for file permissions.
     * @param {SSHFile} file The file object
     * @param {string} permissions File permissions, in the form of rwxrwxrwx (Linux/Unix format)
     */
    constructor(file, permissions= null ) {
        this.update(permissions);
        this.#file = file;
    }

    /**
     * Updates the permissions of the file.
     * @param permissions
     */
    update(permissions) {
        permissions = permissions || this.#permissions || '----------'
        if (/([-d][rwx-]{9}@?)/.test(permissions))
            this.#permissions = permissions;
        else throw new Error('Invalid permissions format: ' + permissions);
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
     * @param {'user' | 'group' | 'other'} accessor Who to check the permissions for.
     *  This can be one of the following: 'user', 'group', 'other'
     * @returns {string} The string representation of the permissions.
     */
    toString(accessor) {
        let perms = [];

        let accepts = ['user', 'group', 'other'];
        let index = accepts.indexOf(accessor);
        if (index < 0)
            throw new Error('Invalid accessor: ' + accessor + ', expected one of: ' + accepts.join(', '));

        for (let i = 0; i < 3; i++) {
            let c = this.#permissions[1 + i + (index * 3)];
            if (c === 'r')
                perms.push('Read');
            else if (c === 'w')
                perms.push('Write');
            else if (c === 'x')
                perms.push('Execute');
        }

        if (perms.length === 1 && perms[0] === 'Read')
            perms = ['Read Only']

        return perms.length === 0 ? 'None' : perms.join('/');
    }
}