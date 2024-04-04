let { app } = require('electron');
let { createWindow } = require('../src/impl/window-impl')
let path = require('path');


const pageName = 'page-file-explorer';

const windowUrl = path.join(__dirname,  '../src/pages/', pageName + '.html');

app.on('window-all-closed', () => {

})
app.whenReady()
    .then(_ => {
        let window = createWindow(windowUrl);
    })

