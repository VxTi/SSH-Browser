let deleteButton;

console.time('Index Page Load Time');
document.addEventListener('DOMContentLoaded', async () =>
{
    deleteButton = document.querySelector('.delete-button');
    document.onclick = () => deleteButton.style.visibility = 'hidden';

    window.ssh.sessions.get()
        .then(results =>
        {
            document.querySelectorAll('.session-loading')
                .forEach(element => element.remove());
            results.forEach(session => addSession(session));
            console.timeEnd('Index Page Load Time');
            document.getElementById('add-sessions')
                .addEventListener('click', () => window.location.href = './pages/page-login-ssh.html');
        })
});


/**
 * Method for adding a session to the list of sessions.
 * @param {ISSHSession} session
 */
function addSession(session)
{
    let sessionContainer = document.querySelector('.session-content');

    let sessionElement = document.createElement('div');
    sessionElement.classList.add('session-element', 'user-interact');
    sessionContainer.appendChild(sessionElement);
    sessionElement.title = 'Join SSH session'

    let sessionHostName = document.createElement('span');
    sessionHostName.classList.add('session-name');
    sessionHostName.innerText = session.host;

    let sessionUserName = document.createElement('span');
    sessionUserName.classList.add('session-name');
    sessionUserName.innerText = session.username;

    let leftSpacing = document.createElement('span');
    leftSpacing.classList.add('inner-icon');

    let rightSpacing = document.createElement('span');
    rightSpacing.classList.add('inner-icon');

    if (session.requiresFingerprintAuth)
    {
        rightSpacing.classList.add('fingerprint-icon');
        rightSpacing.title = 'Fingerprint Authentication';
    }

    sessionElement.appendChild(leftSpacing);
    sessionElement.appendChild(sessionHostName);
    sessionElement.appendChild(sessionUserName);
    sessionElement.appendChild(rightSpacing);
    sessionElement.addEventListener('click', async () =>
    {
        if (session.requiresFingerprintAuth && window.auth.canRequestFingerprint())
            await window.auth.requestFingerprint('SSH Connection Authentication');

        document.querySelector('.session-container').style.visibility = 'hidden';
        document.getElementById('connection-status').style.visibility = 'visible';
        window.ssh.connect({
            host: session.host,
            username: session.username,
            password: session.password,
            port: session.port,
            privateKey: session.privateKey,
            passphrase: session.passphrase
        })
            .then(_ => window.location.href = './pages/page-file-explorer.html')
            .catch(_ =>
            {
                document.getElementById('connection-status').style.visibility = 'hidden';
                document.querySelector('.session-container').style.visibility = 'visible'
            });
    })

    sessionElement.addEventListener('contextmenu', (event) =>
    {
        deleteButton.style.setProperty('--delete-pos-x', `${sessionElement.offsetLeft}px`);
        deleteButton.style.setProperty('--delete-pos-y', `${sessionElement.offsetTop + sessionElement.offsetHeight + 4}px`);
        deleteButton.style.visibility = 'visible';
        deleteButton.onclick = async _ =>
        {
            sessionElement.remove();
            await window.ssh.sessions.delete(session.host, session.username);
        }
    })
}