const path = require('path');

module.exports = {
    entry: {
        "file-explorer-page": [
            './src/js/general-functionality',
            './src/js/custom_elements/file-element.js',
            './src/js/custom_elements/file-hierarchy-element.js',
            './src/js/custom_elements/file-search-result-element.js',
            './src/js/file/file-caching.js',
            './src/js/file/ssh-file.js',
            './src/js/file/file-permissions.js',
            './src/js/handling-file-page.js',
        ],
        "main-page": [
            "./src/js/general-functionality.js",
            "./src/js/handling-sessions-page.js"
        ],
        "login-page": [
            "./src/js/general-functionality.js",
            "./src/js/handling-login-page.js"
        ],
        "file-editor-page": [
            "./src/js/general-functionality.js",
            "./src/js/handling-file-editor.js"
        ],
        "terminal-page": [
            "./src/js/general-functionality.js",
            "./src/js/handling-external-terminal.js",
        ]
    },
    output: {
        filename: '[name]-packed.js',
        path: path.resolve(__dirname, 'src', 'js', 'packed'),
    },
    target: 'web',
    node: {
        __dirname: false,
        __filename: false
    },
    mode: 'production'
}