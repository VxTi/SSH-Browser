
(() => {
    // Set the theme to the user's preference
    document.documentElement.dataset['theme'] = localStorage.theme || 'dark'

    // Register an event listener with an associated callback function
    window.on || (window.on = function(/** @type string */event, /** @type function*/ callback) {
        if (typeof callback !== 'function')
            throw new TypeError('Callback must be a function');
        window.eventQueue || (window.eventQueue = {})               // Create queue object if it doesn't exist
        window.eventQueue[event] || (window.eventQueue[event] = []) // Create associated array in queue
        window.eventQueue[event].push(callback)                     // Add callback to queue
    })

    // Emit an event to all registered event listeners
    window.emit || (window.emit = function(/** @type string */event, /** @type any */...args) {
        if (window.eventQueue && window.eventQueue[event])          // If the event queue exists and the event has listeners
            window.eventQueue[event].forEach(callback => callback(...args))  // call them.
    })

    // If the file icon map hasn't been loaded yet and the html
    // element has the load-icons attribute, load the file_icons.json file
    if (typeof window.iconMap === 'undefined' && document.documentElement.dataset.hasOwnProperty('loadIcons'))
    {
        window.config.get('file_icons.json')
            .then(content =>
            {
                window['iconMap'] = content
                window.resourceLocation = '../resources/file_icons/'
                window.getIcon = function(extension) {
                    extension = extension.toLowerCase().replace(/(\s+)/g, '')
                    return window.resourceLocation +
                    (window.iconMap.find(icon => icon.id === extension || icon.extensions.includes(extension)) || window.iconMap.find(icon => icon.id === 'unknown'))
                        .resource
                }
            })
            .catch(err => window.logger.log('Error loading file_icons.json: ', err));
    }
})()

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-lang]')
        .forEach(element => {
            let key = element.dataset.lang
            element.innerText = window.config.getLang(key)
        })
    document.querySelectorAll('[data-lang-title]')
        .forEach(element => {
            let key = element.dataset.langTitle
            element.title = window.config.getLang(key)
        })
})