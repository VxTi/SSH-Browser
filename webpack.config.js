const path = require('path');

module.exports = {
    entry: {
        "file-explorer": [
            './src/impl/frontend/core-functionality.ts',
            './src/impl/frontend/context-menu.ts',
            './src/impl/frontend/custom-elements/circular-loading-element.ts',
            './src/impl/frontend/custom-elements/file-element.js',
            './src/impl/frontend/custom-elements/file-hierarchy-element.ts',
            './src/impl/frontend/custom-elements/file-search-result-element.ts',
            './src/impl/frontend/file-explorer/file/file-caching.js',
            './src/impl/frontend/file-explorer/file/remote-file.js',
            './src/impl/frontend/file-explorer/file/file-permissions.js',
            './src/impl/frontend/file-explorer/file-hierarchy-impl.ts',
            './src/impl/frontend/file-explorer/handling-file-page.js',
        ],
        "main": [
            "./src/impl/frontend/core-functionality.ts",
            "./src/impl/frontend/custom-elements/session-element.ts",
            "./src/impl/frontend/handling-sessions-page.ts"
        ],
        "login": [
            "./src/impl/frontend/core-functionality.ts",
            "./src/impl/frontend/handling-login-page.js"
        ],
        /** File editor page **/
        "file-editor": [
            "./src/impl/frontend/core-functionality.ts",
            "./src/impl/frontend/handling-file-editor.js"
        ],
        /** Terminal page **/
        "terminal": [
            "./src/impl/frontend/core-functionality.ts",
            "./src/impl/frontend/terminal/handling-external-terminal.ts",
        ]
    },
    output: {
        filename: '[name]-bundle.js',
        path: path.resolve(__dirname, 'src', 'bundles'),
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