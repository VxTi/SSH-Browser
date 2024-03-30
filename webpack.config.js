const path = require('path');

module.exports = {
    entry: {
        "file-explorer-page": [
            './src/js/general-functionality.js',
            './src/js/context-menu.ts',
            './src/js/custom-elements/file-element.js',
            './src/js/custom-elements/file-hierarchy-element.ts',
            './src/js/custom-elements/file-search-result-element.js',
            './src/js/file-explorer/file/file-caching.js',
            './src/js/file-explorer/file/remote-file.js',
            './src/js/file-explorer/file/file-permissions.js',
            './src/js/file-explorer/file-hierarchy-impl.ts',
            './src/js/file-explorer/handling-file-page.js',
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
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    mode: 'development'
}