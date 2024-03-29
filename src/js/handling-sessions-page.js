let deleteButton;

document.addEventListener('DOMContentLoaded', () =>
{
    deleteButton = document.querySelector('.delete-button');
    document.onclick = () => deleteButton.style.visibility = 'hidden';

    window.ssh.sessions.get()
        .then(results =>
        {
            results.forEach(session => addSession(session));
            document.getElementById('add-sessions')
                .addEventListener('click', () => window.location.href = './pages/page-login-ssh.html');
        })
});


/**
 * Method for adding a session to the list of sessions.
 * @param {{port: number, host: string, username: string, password: string, privateKey: string, passphrase: string}} session
 */
function addSession(session)
{
    let sessionContainer = document.querySelector('.session-content');

    let sessionElement = document.createElement('div');
    sessionElement.classList.add('session-element', 'user-interact');
    sessionContainer.appendChild(sessionElement);
    sessionElement.dataset.langTitle = 'session.join.tooltip'

    let sessionHostName = document.createElement('span');
    sessionHostName.classList.add('session-name');
    sessionHostName.innerText = session.host;
    sessionElement.appendChild(sessionHostName);

    let sessionUserName = document.createElement('span');
    sessionUserName.classList.add('session-name');
    sessionUserName.innerText = session.username;
    sessionElement.appendChild(sessionUserName);

    sessionElement.addEventListener('click', () =>
    {
        document.querySelector('.session-container').style.visibility = 'hidden';
        document.getElementById('connection-status').style.visibility = 'visible';
        window.ssh.connect(session.host, session.username, session.password, session.port, session.privateKey, session.passphrase)
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