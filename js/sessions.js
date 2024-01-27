let delete_button;
document.addEventListener('DOMContentLoaded', async () => {
    delete_button = document.querySelector('.delete-button');
    document.onclick = () => delete_button.style.visibility = 'hidden';

    await window.ssh.sessions.get()
        .then(results => {
            results.forEach(session => addSession(session));
            let addSessionElement = document.createElement('div');
            addSessionElement.classList.add('session-element', 'add-session', 'user-interact');
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
    session_element.classList.add('session-element', 'user-interact');
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

    session_element.onmousedown = (event) => {
        if (event.button !== 2) return;
        delete_button.style.setProperty('--delete-pos-x', `${session_element.offsetLeft}px`);
        delete_button.style.setProperty('--delete-pos-y', `${session_element.offsetTop + session_element.offsetHeight}px`);
        delete_button.style.visibility = 'visible';
    }
}