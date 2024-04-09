import { FileElement } from "../custom-elements/file-explorer/file-element";
import { getFile } from "./file/file-caching";
import RemoteFile from "./file/remote-file";
import { resourceFromFileExtension } from "../core-functionality";

/**
 * Function to show the information of a file in a popup.
 * The function generates all the necessary elements and appends them to the body.
 * @param file The file element to show the information of.
 */
export async function showFileInfo(file: FileElement)
{
    let representingFile: RemoteFile = getFile(file.getAttribute('path'), file.getAttribute('name'));

    // Ensure the file exists in the cache
    if ( representingFile === null )
        return;

    // Load the file information if it hasn't been loaded yet
    if (!representingFile.loaded)
        await representingFile.loadInfo();

    // Get the position of the file element
    let rect = file.getBoundingClientRect();
    let [ posX, posY ] = [ rect.left, rect.top ];

    // Container holding all the info elements
    let fileInfoContainer = document.createElement('div');
    fileInfoContainer.classList.add('file-information', 'container', 'popup');
    fileInfoContainer.id = 'file-information';
    fileInfoContainer.style.setProperty('--x', posX + 'px');
    fileInfoContainer.style.setProperty('--y', posY + 'px');

    // Preview picture of the file
    let previewElement = document.createElement('div');
    previewElement.classList.add('file-info-preview');
    previewElement.style.backgroundImage = `url(${resourceFromFileExtension(representingFile.type)})`
    fileInfoContainer.appendChild(previewElement);

    // Title of the file
    let titleElement = document.createElement('div');
    titleElement.classList.add('file-info');
    titleElement.textContent = representingFile.name;

    // Add all the file information to the container
    [
        ['Date modified', representingFile.lastModified],
        ['Created by', representingFile.owner],
        ['Size', representingFile.fileSizeString],
        ['User', representingFile.permissions.toString('user')],
        ['Group', representingFile.permissions.toString('group')],
        ['Other', representingFile.permissions.toString('other')]
    ]
        .forEach(([title, value]) =>
    {
        let infoElement = document.createElement('div');
        infoElement.classList.add('file-info-section');

        let titleElement = document.createElement('span');
        titleElement.classList.add('file-info');
        titleElement.textContent = title;

        let valueElement = document.createElement('span');
        valueElement.textContent = value;
        valueElement.classList.add('file-info');

        infoElement.appendChild(titleElement);
        infoElement.appendChild(valueElement);

        fileInfoContainer.appendChild(infoElement);
    })

    // Add the file information container to the body
    document.body.appendChild(fileInfoContainer);
}