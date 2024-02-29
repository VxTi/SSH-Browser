let contentLines = [""];
let contentCursorHorizontal = 0;
let lineNumber = 0;
let __indentation = 4;
let __fileType = null;
let __remotePath = null;
let __localPath = null;
let __fileName = null;

window.events.on('file-editor-set-indentation', count => __indentation = count);
window.events.on('file-editor-remote-path', path => __remotePath = path);
window.events.on('file-editor-local-path', path => __localPath = path);
window.events.on('file-editor-file-name', name =>
{
    __fileName = name;
    __fileType = name.split('.').pop();
});
window.events.on('file-editor-content', content =>
{
    contentLines = content.split("\n");
    parseContent();
});

document.addEventListener('DOMContentLoaded', () =>
{
    // Save the elements to the window object for later use.
    window.lineNumbers = document.getElementById('line-numbers');
    window.fileEditorContent = document.getElementById('file-editor-content');
    window.codeContent = document.getElementById('file-editor-content');

    // Add functionality for action buttons
    document.getElementById('save-upload')
        .addEventListener('click', async _ =>
        {
            // Save the file locally (to the cache)
            if (!(await __saveFileLocally()))
                return window.emitError('Failed to save file locally');

            if (!(await __uploadFile()))
                return window.emitError('Failed to upload file to the server');
            // TODO: Add success message (?)
        })

    document.getElementById('action-reload')
        .addEventListener('click', async _ => await __reloadFile())

});

document.addEventListener('keypress', (event) =>
{
    insert(event.key, lineNumber, contentCursorHorizontal);
    contentCursorHorizontal++;
    moveCursor(lineNumber, contentCursorHorizontal);
})
document.addEventListener('keydown', (e) =>
{
    e.preventDefault();
    switch (e.key)
    {
        case "ArrowRight": // TODO: Add overflow functionality
            contentCursorHorizontal++;
            break;
        case "ArrowUp":    // TODO: Fix underflow
            lineNumber--;
            break;
        case "ArrowDown": // TODO: Fix overflow
            lineNumber++;
            break;
        case "ArrowLeft":  // TODO: Add overflow functionality
            contentCursorHorizontal--;
            break;
        case "Tab":
            insert((" ").repeat(__indentation), lineNumber, contentCursorHorizontal);
            contentCursorHorizontal += 4;
            break;
        case "Backspace":
            if ((e.ctrlKey || e.metaKey) && lineNumber > 0)
            {
                deleteLine(lineNumber);
                lineNumber--;
            }
            else if (contentCursorHorizontal > 0)
            {
                deleteCharacter(lineNumber, contentCursorHorizontal);
                contentCursorHorizontal--;
            }
            break;
        case "Enter":
            insert("\n", lineNumber, contentCursorHorizontal);
            lineNumber++;
            contentCursorHorizontal = 0;
            break;
    }
    moveCursor(lineNumber, contentCursorHorizontal);
})

function insert(content, lineNumber, horizontalPosition)
{
    contentLines[lineNumber] = contentLines[lineNumber].slice(0, horizontalPosition) + content + contentLines[lineNumber].slice(horizontalPosition);
    parseContent();
}

function deleteCharacter(lineNumber, horizontalPosition)
{
    contentLines[lineNumber] = contentLines[lineNumber].slice(0, horizontalPosition) + contentLines[lineNumber].slice(horizontalPosition + 1);
    parseContent();
}

function deleteLine(lineNumber)
{
    contentLines.splice(lineNumber, 1);
    parseContent();
}

function parseContent()
{
    let lines = window.codeHighlighting.highlight(contentLines.join("\n"), __fileType).split("\n");

    let targetElement = document.getElementById("file-editor-content");
    let lineNumbers = document.getElementById('line-numbers');
    lineNumbers.innerHTML = "";
    for (let i = 0; i < lines.length; i++)
    {
        lines[i] = `<div class="line-content content-text" data-line-number="${i + 1}">${lines[i] || ' '}</div></div>`;

        let lineNumber = document.createElement('div');
        lineNumber.classList.add('line-number', 'content-text');
        lineNumber.innerText = `${i + 1}`;
        lineNumber.dataset.lineNumber = `${i + 1}`;
        lineNumbers.appendChild(lineNumber);
    }
    targetElement.innerHTML = lines.join("");

}

function moveCursor(line, horizontal)
{
    // TODO: Add implementation
}

/**
 * Save the file locally (to the cache)
 * @returns {Promise<boolean>} Whether or not the file was saved successfully
 * @private
 */
async function __saveFileLocally()
{
    return await window.localFs.saveFile(
        __localPath + '/' + __fileName,
        contentLines.join("\n")
    )
        .then(_ => true)
        .catch(_ => false);
}

/**
 * Upload the file to the server.
 * This only serves a purpose if the file is actually
 * edited.
 * @returns {Promise<boolean>}
 * @private
 */
async function __uploadFile()
{
    return await window.ssh.uploadFiles(__remotePath, [__localPath + '/' + __fileName])
        .then(_ => true)
        .catch(_ => false);
}

async function __reloadFile()
{
    // TODO: Fix implementation
    /*console.log("Reloading file")
    return await window.ssh.downloadFile(__remotePath, __localPath)
        .then(content =>
        {
            contentLines = content.split("\n");
            parseContent();
            return true;
        })
        .catch(_ => false);*/
}