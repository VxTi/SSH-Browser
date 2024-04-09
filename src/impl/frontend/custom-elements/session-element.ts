import ISSHSession from "../../utilities/ssh-session-interface";

/**
 * @file session-element.ts
 * @description Custom element for displaying a session
 *
 * This file represents a custom HTML element that displays a session.
 * When the session element is clicked on, a 'session-authentication' event is dispatched.
 * This then tries to connect to the session using the SSH connection.
 * If the session requires fingerprint authentication, it will request the fingerprint.
 * If the fingerprint authentication or SSH authentication fails, a 'session-auth-failed' event is dispatched.
 * When successful, a 'session-connected' event is dispatched.
 */
export class SessionElement extends HTMLElement {

    /**
     * Private fields for the session element.
     */
    private _session: ISSHSession;

    constructor(session: ISSHSession)
    {
        super();
        this._session = session;
        this.setAttribute('username', session.username || '');
        this.setAttribute('host', session.host || 'localhost');
        this.setAttribute('port', session.port?.toString() || '22');
        this.setAttribute('fingerprint-auth', session.requiresFingerprintAuth?.toString() || 'false');
        this.addEventListener('click', this.onClick.bind(this));
    }


    /**
     * Handler for when the element is connected to the DOM.
     */
    connectedCallback()
    {
        let shadowDom: ShadowRoot = this.attachShadow({mode: 'open'});

        let styles = document.createElement('style');
        styles.textContent = `
            .main {
                display: flex; flex-flow: row nowrap; align-items: center; justify-content: space-evenly;
                background-color: var(--theme-1);
                margin: var(--session-margin);
                padding: var(--session-padding);
                cursor: pointer;
                border: 1px solid var(--border-2);
                user-select: none;
                box-sizing: border-box;
                width: var(--session-element-width);
                max-width: var(--max-session-element-width);
                min-height: var(--session-height);
                transition: all 0.4s ease-in-out, border-color 0s ease-in-out, width 0s ease-in-out;
            }
            .main:hover { border-color: var(--text-color-2); }
            .spacing {
                flex: 0.1;
                min-width: var(--session-height);
                min-height: var(--session-height);
            }
            .text {
                color: var(--text-color);
                font-family: var(--font);
                color: var(--text-color-2);
                width: auto;    
                font-size: 1rem;
                flex: 0.26;
                text-align: center;
            }
            .print {
                width: var(--session-height);
                height: var(--session-height);
                background-size: calc(var(--session-height) - 10px);
                background-position: center;
                background-repeat: no-repeat;
                background-image: url("../resources/fingerprint.png");
            }
        `;

        let mainElement = document.createElement('div');
        mainElement.classList.add('main');

        let spacing = document.createElement('span');
        spacing.classList.add('spacing');

        let usernameLabel = document.createElement('span');
        usernameLabel.textContent = this.getAttribute('username');
        usernameLabel.classList.add('text');

        let hostnameLabel = document.createElement('span');
        hostnameLabel.textContent = this.getAttribute('host');
        hostnameLabel.classList.add('text');

        let portLabel = document.createElement('span');
        portLabel.textContent = this.getAttribute('port');
        portLabel.classList.add('text');

        let fingerprintAuthLabel = document.createElement('span');
        fingerprintAuthLabel.classList.add('print', 'spacing');
        fingerprintAuthLabel.setAttribute('active', this.getAttribute('fingerprint-auth'));

        mainElement.appendChild(spacing);
        mainElement.appendChild(hostnameLabel);
        mainElement.appendChild(usernameLabel);
        mainElement.appendChild(portLabel);
        mainElement.appendChild(fingerprintAuthLabel);

        shadowDom.appendChild(styles);
        shadowDom.appendChild(mainElement);
    }

    /**
     * Handler for when the element is clicked.
     * @private
     */
    private async onClick()
    {
        window.dispatchEvent(new CustomEvent('session-authentication'));
        if ( this.getAttribute('fingerprint-auth') === 'true' && window['app']['auth'].canRequestFingerprint() )
        {
            // Request fingerprint authentication.
            if (!(await window['app']['auth'].requestFingerprint('SSH Authentication')))
            {
                window.dispatchEvent(new CustomEvent('session-auth-failed', { detail: 'Fingerprint authentication failed.' }));
                return;
            }
        }
        // Connect to the session.
        window['ssh'].connect({
            host: this._session.host,
            username: this._session.username,
            password: this._session.password,
            port: this._session.port,
            privateKey: this._session.privateKey,
            passphrase: this._session.passphrase
        })
            .then(_ => window.dispatchEvent(new CustomEvent('session-connected')))
            .catch(_ => window.dispatchEvent(new CustomEvent('session-auth-failed', { detail: 'SSH connection failed.' })));
    }

}

customElements.define('session-element', SessionElement);