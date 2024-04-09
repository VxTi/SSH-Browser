/**
 * File explorer navigation.
 * @fileoverview This file provides functions for navigating the file explorer.
 * @module file-explorer/navigation
 */

import * as cache from "./file/file-caching";
import RemoteFile from "./file/remote-file";

/**
 * The current path of the file explorer.
 */
export let currentPath: string = '/';

/**
 * The navigation history of the file explorer ( forward / redo ).
 */
export let navigationForwardHistory: string[] = [];

/**
 * The navigation history of the file explorer ( backward / undo ).
 */
export let navigationBackwardHistory: string[] = [];

/**
 * Navigates to the specified path on the remote server,
 * and displays the contents on the file explorer.
 * @param path The path to navigate to.
 */
export function navigateTo(path: string): void
{
    // Set the current path to the new path.
    currentPath = path;

    window[ 'ssh' ]
        .listFiles( path ) // Retrieve files from selected directory
        .then( (result: string[]) =>
        {
            // Add the current path to the navigation history.
            navigationBackwardHistory.push( currentPath );
            cache.storeFiles( result, path );
            currentPath = path;
            window.dispatchEvent( new CustomEvent( 'file-explorer:navigate', { detail: { path: path } } ) );
        } )
        .catch( _ =>
        {   // If an error occurs whilst
            window[ 'app' ][ 'logger' ].log( 'Error occurred whilst attempting to navigate', _ )
        } );
}

/**
 * Function for navigating to the path of a file
 */
export function navigateToFile(target: RemoteFile): void
{
    let path = target.path + (target.directory ? '/' + target.name : '');
    navigateTo( path );
}

/**
 * Function for navigating to the previous directory ( if available ).
 */
export function navigateBackward(): void
{
    let path = navigationBackwardHistory.pop();
    if ( path )
    {
        navigationForwardHistory.push( currentPath );
        navigateTo( path );
    }
}

/**
 * Function for navigating to the next directory ( if available ).
 */
export function navigateForward(): void
{
    let path = navigationForwardHistory.pop();
    if ( path )
    {
        navigateTo( path );
    }
}