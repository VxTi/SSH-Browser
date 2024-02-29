
let contentLines = [""];
let contentCursorHorizontal = 0;
let lineNumber = 0;
let spaceCount = 4;
let language = "javascript";

window.events.on('file-editor-language-configuration', lang => language = lang);
window.events.on('file-editor-space-count-configuration', count => spaceCount = count);
window.events.on('file-editor-content', content =>
{
    contentLines = content.split("\n");
    parseContent();
});

document.addEventListener('DOMContentLoaded', () => {
})

document.addEventListener('keydown', (e) => {
    e.preventDefault();
    switch (e.key) {
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
            insert((" ").repeat(spaceCount), lineNumber, contentCursorHorizontal);
            contentCursorHorizontal += 4;
            break;
        case "Backspace":
            deleteCharacter(lineNumber, contentCursorHorizontal);
            contentCursorHorizontal--;
            break;
    }
})

function insert(content, lineNumber, horizontalPosition) {
    contentLines[lineNumber] = contentLines[lineNumber].slice(0, horizontalPosition) + content + contentLines[lineNumber].slice(horizontalPosition);
    parseContent();
}

function deleteCharacter(lineNumber, horizontalPosition) {
    contentLines[lineNumber] = contentLines[lineNumber].slice(0, horizontalPosition) + contentLines[lineNumber].slice(horizontalPosition + 1);
    parseContent();
}

function deleteLine(lineNumber) {
    contentLines.splice(lineNumber, 1);
    parseContent();
}

function parseContent() {
    let lines = window.codeHighlighting.highlight(contentLines.join("\n"), language).split("\n");
    let targetElement = document.getElementById("file-editor-content");

    for (let i = 0; i < lines.length; i++) {
        lines[i] = `<div class="line"><div class="line-number">${i + 1}</div><div class="line-content">${lines[i]}</div></div>`;
    }
    targetElement.innerHTML = lines.join("");

}