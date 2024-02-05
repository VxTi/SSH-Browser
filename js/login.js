
$(document).ready(() => {
    // Get the input fields
    let [host, username, password, port, privateKey, passphrase] = $('#ssh-host, #ssh-username, #ssh-password, #ssh-port, #ssh-private-key, #ssh-passphrase')

    $('#ssh-show-password').on('click', () => {
        let e = $('#ssh-password');
        e.attr('type', e.attr('type') === 'password' ? 'text' : 'password');
        $(this).toggleClass('password-invisible');
    })

    // Add the back button functionality
    $('#ssh-back-button').on('click', () => window.location.href = '../index.html');

    // Add the login functionality
    $('#ssh-login').on('click', () => {

        // Check if there's actually input in the fields
        if (!host.value || !username.value) {
            let errorContainer = $('.error-message');
            errorContainer.css('visibility', 'visible');
            errorContainer.text('Please enter a valid host and username.');
            return;
        }

        $('.login-container').css('visibility', 'hidden');
        $('.loading').css('visibility', 'visible');

        // Send a request to log in with the retrieved input.
        window.ssh.connect(host.value, username.value, password.value, parseInt(port.value), privateKey.value, passphrase.value)
            .then(_ => window.location.href = './file_viewer.html')     // Redirect to the file viewer page.
            .catch(err => {
                $('.login-container').css('visibility', 'visible');
                $('.loading').css('visibility', 'hidden');
                let errorContainer = $('.error-message');
                errorContainer.css('visibility', 'visible');
                errorContainer.text(err.message);
            });
    })
})