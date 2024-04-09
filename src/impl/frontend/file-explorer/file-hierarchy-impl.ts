import { FileHierarchyElement } from "../custom-elements/file-explorer/file-hierarchy-element";
import { createContainer } from "./file-hierarchy-container";


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
        console.error( `The file retrieval function must be a function. (${ typeof fileRetrievalFunction } given)` );
        return;
    }
    // TODO -- Implement
}