
/**
 * Whether fingerprint authentication should be enabled,
 * if the device supports it.
 */
const FINGERPRINT_AUTHENTICATION = true;

document.addEventListener('DOMContentLoaded', _ =>
{
    // Get the input fields
    let [ host, username, password, port, privateKey, passphrase ]
        = [ 'ssh-host', 'ssh-username', 'ssh-password', 'ssh-port', 'ssh-private-key', 'ssh-passphrase' ]
        .map(id => document.getElementById(id));

    /** Functionality of toggling password visibility */
    let showPasswordElement = document.getElementById('ssh-show-password');
    showPasswordElement.setAttribute('shown', 'false');
    showPasswordElement.addEventListener('click', () =>
    {
        let passwordInput = document.getElementById('ssh-password');
        passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
        showPasswordElement.setAttribute('shown', passwordInput.type === 'text' ? 'true' : 'false');
    });

    /** Functionality of toggling fingerprint authentication */
    let fingerprintEnabled = FINGERPRINT_AUTHENTICATION;

    if (window.auth.canRequestFingerprint())
    {
        let targetElement = document.getElementById('ssh-fingerprint-auth');
        targetElement.setAttribute('active', '');
        targetElement.setAttribute('enabled', fingerprintEnabled.toString());
        targetElement.addEventListener('click', event => {
            fingerprintEnabled = !fingerprintEnabled;
            targetElement.setAttribute('enabled',  fingerprintEnabled ? 'true' : 'false');
        });
    }

    /** Functionality of selecting a private key from a file */
    document.getElementById('ssh-select-private-key')
        .addEventListener('click', _ => {
            window.ssh.selectFiles({properties: [ 'openFile' ]})
                .then(files => {
                    window['logger'].log(files);
                });
        });

    // Add the back button functionality
    document.getElementById('ssh-back-button')
        .addEventListener('click', () => window.location.href = '../../pages/index.html');

    /** Functionality of logging in */
    document.getElementById('ssh-login').addEventListener('click', () =>
    {
        // Check if there's actually input in the fields
        if ( host.value.length === 0 || username.value.length === 0 )
        {
            let errorContainer = document.querySelector('.error-message');
            errorContainer.style.visibility = 'visible';
            errorContainer.textContent = 'Please enter a valid host and username.';
            return;
        }

        document.querySelector('.login-container')
            .style.visibility = 'hidden';
        document.getElementById('connection-status')
            .style.visibility = 'visible';

        // Send a request to log in with the retrieved input.
        window.ssh.connect({
            host: host.value,
            username: username.value,
            password: password.value,
            port: parseInt(port.value),
            privateKey: privateKey.value,
            passphrase: passphrase.value,
            requiresFingerprintAuth: fingerprintEnabled
        })
            .then(_ => window.location.href = './page-file-explorer.html')     // Redirect to the file viewer page.
            .catch(err =>
            {
                document.getElementById('connection-status').style.visibility = 'hidden';
                document.querySelector('.login-container')
                    .style.visibility = 'visible';
                let errorContainer = document.querySelector('.error-message');
                errorContainer.style.visibility = 'visible';
                errorContainer.textContent;
            });
    })
})