import { FileHierarchyElement } from "../custom-elements/file-hierarchy-element";


/**
 * Function for generating a file hierarchy from a given file retrieval function.
 * This function
 * @param fileRetrievalFunction The function used to retrieve the files from the server.
 * @param path The path to the directory where the file hierarchy will be generated.
 * @param dstContainer The container element where the file hierarchy will be placed.
 */
export function assembleFileHierarchy(fileRetrievalFunction: (arg0: string) => Promise<string[]>, path: string, dstContainer: HTMLElement): void
{

    if ( typeof fileRetrievalFunction !== 'function' )
    {
        console.error(`The file retrieval function must be a function. (${typeof fileRetrievalFunction} given)`);
        return;
    }

    // Clear the container.
    dstContainer.innerHTML = '';

    // @ts-ignore
    let segments: string[] = window.path.dissect(path);

    segments.forEach((segment, index) =>
    {
        let element = new FileHierarchyElement();
        element.setAttribute('name', segment);
        element.setAttribute('type', 'dir');
        element.setAttribute('path', segments.slice(0, index).join('/'));
        element.setAttribute('nesting-level', index.toString());
        dstContainer.appendChild(element);
    });

    (async () =>
    {
        (await fileRetrievalFunction(path) || []).forEach(fileName =>
        {
            let element = new FileHierarchyElement();
            element.setAttribute('name', fileName);
            element.setAttribute('type', fileName.split('.').pop() || 'unknown');
            element.setAttribute('path', path);
            element.setAttribute('nesting-level', segments.length.toString());
            dstContainer.appendChild(element);
        });
    })();
}