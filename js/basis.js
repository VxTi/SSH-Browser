
(() => {
    // Set the theme to the user's preference
    document.documentElement.dataset['theme'] = localStorage.theme || 'dark'

    // If the file icon map hasn't been loaded yet and the html
    // element has the load-icons attribute, load the file_icons.json file
    if (typeof window.iconMap === 'undefined' && document.documentElement.dataset.hasOwnProperty('loadIcons'))
    {
        window.config.get('file_icons.json')
            .then(content =>
            {
                window.logger.log("Loaded file icon map")
                window['iconMap'] = content
            })
            .catch(err => window.logger.log('Error loading file_icons.json: ', err));
    }
})()