import RemoteFile from "./file/remote-file.js";
import ISSHSession from "../../utilities/ssh-session-interface";

/**
 * Function for deleting a file from the file explorer,
 * with a provided SSH Session.
 * @param session The session from which to delete the file from
 * @param files The files to delete
 */
export function deleteFiles(session: ISSHSession, files: RemoteFile[] | string[]): Promise<void | Error>
{
    return new Promise((resolve, reject) =>
    {
        if ( files.length === 0 )
            return reject('No files provided');
        return Promise.all(files.map(file =>
        {
            let path = file instanceof RemoteFile ? file.path : file;
            // @ts-ignore
            return window.ssh.deleteFile(path)
        }))
    });
}


/**
 * Function for adding files to the file explorer from the local file system.
 * @param session The session to add the files to.
 * @param files The files to add.
 * @param destination The destination to add the files to.
 */
export function addFiles(session: ISSHSession, destination: string, ...files: RemoteFile[] | string[]): Promise<void | Error>
{
    return new Promise((resolve, reject) =>
    {
        // For when no files are provided.
        if ( files === undefined || files.length === 0 )
            return reject('No files provided');
        // @ts-ignore
        window.ssh.uploadFiles(destination, files)
            .then(resolve)
            .catch(reject);
    });
}

/**
 * Function for renaming a file in the file explorer.
 * @param session The session from which to rename the file.
 * @param file The file to rename.
 * @param newName The new name for the file.
 */
export function renameFile(session: ISSHSession, file: RemoteFile | string, newName: string): Promise<void | Error>
{
    return new Promise((resolve, reject) =>
    {
        let path = file instanceof RemoteFile ? file.path : file;
        // @ts-ignore
        window.ssh.renameFile(path, newName)
            .then(resolve)
            .catch(reject);
    });
}