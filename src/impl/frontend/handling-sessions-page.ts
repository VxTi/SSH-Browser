/**
 * Implementation of the index page for the SSH sessions.
 */

import contextmenu from './context-menu';
import { SessionElement } from "./custom-elements/session-element";
import ISSHSession from "../utilities/ssh-session-interface";
import toHtml from "../parsers/parsers";


const changelogFileUrl = 'https://raw.githubusercontent.com/VxTi/SSH-FTP/main/changelog.md';

document.addEventListener( 'DOMContentLoaded', async () =>
{

    contextmenu.register( 'delete-session', [
        {
            title: 'Delete Session', type: 'normal', click: async (element: SessionElement) =>
            {
                element.remove();
                // @ts-ignore
                await window.ssh.sessions.delete(
                    element.getAttribute( 'host' ),
                    element.getAttribute( 'username' ),
                    element.getAttribute( 'port' )
                );
            }
        }
    ] )

    document.addEventListener( 'contextmenu', event =>
    {
        event.preventDefault();
        if ( event.target instanceof SessionElement )
            contextmenu.show( 'delete-session', event.clientX, event.clientY, event.target );
    } )

    document.addEventListener( 'click', _ => contextmenu.destroy() );

    let searchElements = document.getElementById( 'search-sessions' );
    let targetContainer = document.getElementById( 'sessions-inner-container' );

    // Add search input functionality
    searchElements.addEventListener( 'input', event =>
    {
        let searchValue = (event.target as HTMLInputElement).value.toLowerCase();
        let sessionElements = targetContainer.querySelectorAll( 'session-element' );

        // If the input box is empty, make all elements visible
        if ( searchValue.length === 0 )
        {
            sessionElements.forEach( element => element.setAttribute( 'invisible', 'false' ) );
            return;
        }

        // Check if any of the text contents contains the input text
        sessionElements.forEach( element =>
        {
            element.setAttribute(
                'invisible',
                ( ![
                    element.getAttribute( 'host' ),
                    element.getAttribute( 'username' ),
                    element.getAttribute( 'port' )
                ]
                    .some( name => name.toLowerCase().includes( searchValue ) )).toString() );
        } );
    } );

    /** Load in the session data and convert retrieved data to elements **/
    // @ts-ignore
    window[ 'ssh' ].sessions.get()
        .then( (results: ISSHSession[]) =>
        {
            document.querySelectorAll( '.session-loading' )
                .forEach( element => element.remove() );
            results.forEach( session => __addSession( session ) );
            document.getElementById( 'add-sessions' )
                .addEventListener( 'click', () => window.location.href = './page-login-ssh.html' );
        } )

    // Event listener for when a session authentication is requested.
    window.addEventListener( 'session-authentication', event =>
    {
        document.getElementById( 'main-container' )
            .style.display = 'none';
        document.getElementById( 'connection-status' )
            .setAttribute( 'visible', '' );
        window[ 'logger' ].log( 'Authentication requested...' )
    } )

    // Event listener for when a session authentication failed.
    window.addEventListener( 'session-auth-failed', (event) =>
    {
        document.getElementById( 'main-container' )
            .style.display = 'block';
        document.getElementById( 'connection-status' )
            .removeAttribute( 'visible' );
        window.dispatchEvent( new CustomEvent( 'show-notification', { detail: event[ 'detail' ] || 'Authentication Failed' } ) );
    } )
    // Event listener for when a session is connected.
    window.addEventListener( 'session-connected', _ => window.location.href = './page-file-explorer.html' );
    // FIXME: Temporary.
    /*
    // Acquire most recent application version
    fetch( changelogFileUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'text/plain' }
    } )
        .then( response => response.text() )
        .then( text =>
        {
            if ( text.length === 0 )
                return;

            let versionName = text.substring( 0, text.indexOf( '\n' ) );

            // Check if there's a new version that came out
            if ( window[ 'app' ].version.toString() !== versionName &&
                window.localStorage[ 'shown-changelog' ] !== versionName )
            {
                __showUpdatePage( text );
            }
            window.localStorage[ 'shown-changelog' ] = versionName;
        } )
        .catch(_ => window['logger'].log('Failed to fetch changelog.'));*/
} );

/**
 * Method for adding a session to the list of sessions.
 * @param session The session to add.
 */
function __addSession(session: ISSHSession)
{
    let sessionContainer = document.getElementById( 'sessions-inner-container' );
    console.log( session );
    let sessionElement = new SessionElement( session );
    sessionContainer.appendChild( sessionElement );
}

/**
 * Function for showing a changelog page when the app starts up.
 */
function __showUpdatePage(changelog: string)
{
    let targetContainer = document.getElementById( 'content' );

    let changelogHtml = toHtml( 'text/markdown', changelog );

    // Add the markdown styling to the page
    let styles = document.createElement( 'style' );
    styles.setAttribute( 'rel', 'stylesheet' );
    styles.setAttribute( 'href', '../css/code/markdown.css' );
    document.head.appendChild( styles );

    targetContainer.innerHTML += `
    <div class="changelog">
        <div class="changelog-container container">
            <span class="app-icon icon"></span>
            <div class="changelog-text">
                ${ changelogHtml }
            </div>
            <div class="close-button">Close</div>
        </div>
    </div>
    `;
}