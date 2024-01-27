document.addEventListener('DOMContentLoaded', () => {
    let [host, username, password] = [
        document.getElementById('ssh-host'),
        document.getElementById('ssh-username'),
        document.getElementById('ssh-password')
    ];

    let show_pass = document.getElementById("ssh-show-password");
    show_pass.addEventListener('click', () => {
        password.type = password.type === 'password' ? 'text' : 'password';
        show_pass.classList.toggle('password-invisible');
    });

    //E+OG3S3pUoksEX

    document.getElementById('ssh-back-button').onclick = () => window.location.href = '../index.html';

    // Add the login functionality
    document.getElementById('ssh-login').onclick = () => {

        document.querySelector('.login-container').style.visibility = 'hidden';
        document.querySelector('.loading').style.visibility = 'visible';

        // Send a request to log in with the retrieved input.
        window.ssh.connect(host.value, username.value, password.value)
            .then(_ => {
                document.querySelector('.login-container').style.visibility = 'visible';
                document.querySelector('.loading').style.visibility = 'hidden';
                window.location.href = './file_viewer.html';
            })
            .catch(err => {
                document.querySelector('.login-container').style.visibility = 'visible';
                document.querySelector('.loading').style.visibility = 'hidden';
                console.log(err);
            });
    }
})