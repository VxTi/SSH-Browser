import { RemoteFile } from "./file/remote-file.js";


type FilePath = string | RemoteFile;

export function deleteFile(files: RemoteFile[])
{
    return new Promise((resolve, reject) => {
        if (files.length === 0)
            return reject('No files provided');
        // @ts-ignore
        return Promise.all(files.map(file => window.ssh.deleteFile(file.path)))
    });
}

/**
 * Function for adding files to the file explorer from the local file system.
 * @param files The files to add.
 * @param destination The destination to add the files to.
 */
export function addFiles(destination: string, ...files: FilePath[])
{

    return new Promise((resolve, reject) => {
        // For when no files are provided.
        if (files === undefined || files.length === 0)
            return reject('No files provided');
        // @ts-ignore
        window.ssh.uploadFiles(destination, files)
            .then(resolve)
            .catch(reject);
    });
}