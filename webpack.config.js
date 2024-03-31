const path = require('path');

module.exports = {
    entry: {
        "file-explorer-page": [
            './src/script/general-functionality.js',
            './src/script/context-menu.ts',
            './src/script/custom-elements/file-element.js',
            './src/script/custom-elements/file-hierarchy-element.ts',
            './src/script/custom-elements/file-search-result-element.js',
            './src/script/file-explorer/file/file-caching.js',
            './src/script/file-explorer/file/remote-file.js',
            './src/script/file-explorer/file/file-permissions.js',
            './src/script/file-explorer/file-hierarchy-impl.ts',
            './src/script/file-explorer/handling-file-page.js',
        ],
        "main-page": [
            "./src/script/general-functionality.js",
            "./src/script/handling-sessions-page.js"
        ],
        "login-page": [
            "./src/script/general-functionality.js",
            "./src/script/handling-login-page.js"
        ],
        "file-editor-page": [
            "./src/script/general-functionality.js",
            "./src/script/handling-file-editor.js"
        ],
        "terminal-page": [
            "./src/script/general-functionality.js",
            "./src/script/handling-external-terminal.js",
        ]
    },
    output: {
        filename: '[name]-packed.js',
        path: path.resolve(__dirname, 'src', 'script', 'packed'),
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
    optimization: {
        minimize: true,
        mergeDuplicateChunks: true,
    },
    mode: 'production'
}