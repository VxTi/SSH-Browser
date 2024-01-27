document.addEventListener('DOMContentLoaded', async () => {
    await window.ssh.sessions.get()
        .then(results => {
            results.forEach(session => addSession(session));
            let addSessionElement = document.createElement('div');
            addSessionElement.classList.add('session-element', 'add-session');
            addSessionElement.onclick = () => window.location.href = './pages/login_page.html';
            document.querySelector('.session-content').appendChild(addSessionElement);
        })
});


/**
 * Method for adding a session to the list of sessions.
 * @param {{port: number, host: string, username: string, password: string, privateKey: string}} session
 */
function addSession(session) {
    let session_container = document.querySelector('.session-content');

    let session_element = document.createElement('div');
    session_element.classList.add('session-element');
    session_container.appendChild(session_element);

    let session_host = document.createElement('span');
    session_host.classList.add('session-name');
    session_host.innerText = session.host;
    session_element.appendChild(session_host);

    let session_name = document.createElement('span');
    session_name.classList.add('session-name');
    session_name.innerText = session.username;
    session_element.appendChild(session_name);

    session_element.onclick = () => {
        window.ssh.connect(session.host, session.username, session.password, session.port, session.privateKey)
            .then(_ => window.location.href = './pages/file_viewer.html');
    }
}