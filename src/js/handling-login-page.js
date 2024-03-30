document.addEventListener('DOMContentLoaded', _ =>
{
    // Get the input fields
    let [ host, username, password, port, privateKey, passphrase ]
        = [ 'ssh-host', 'ssh-username', 'ssh-password', 'ssh-port', 'ssh-private-key', 'ssh-passphrase' ]
        .map(id => document.getElementById(id));

    let showPasswordElement = document.getElementById('ssh-show-password')
    showPasswordElement.addEventListener('click', () =>
    {
        let passwordInput = document.getElementById('ssh-password');
        passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
        showPasswordElement.setAttribute('shown', passwordInput.type === 'text' ? 'true' : 'false');
    })

    // Add the back button functionality
    document.getElementById('ssh-back-button')
        .addEventListener('click', () => window.location.href = './index.html');

    // Add the login functionality
    document.getElementById('ssh-login').addEventListener('click', () =>
    {
        console.log(host.value, username.value, password.value);
        console.log(host.value.length, username.value.length, password.value.length)

        // Check if there's actually input in the fields
        if ( host.value.length === 0 || username.value.length === 0 )
        {
            console.log(host, username)
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
        window.ssh.connect(host.value, username.value, password.value, parseInt(port.value), privateKey.value, passphrase.value)
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