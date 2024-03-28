/** @type {Object<boolean>} */
let __keyStates = {};

/** @type {Object} */
let __keybinds = null;

/** @type {Array<Object<function>>} */
let __keybindMappings = [];

/** @type {Object} */
let __languages;

window.emitError = function (error)
{
    // TODO: Add implementation
}

/**
 *  Once the page has successfully been loaded, we'll have
 *  to load all languages from the languages.json file and
 *  update them onto the page. We'll also have to set the
 *  theme to the user's preference, load the file_icons.json
 *  and load the keybinds from the keybinds.json file.
 */
document.addEventListener('DOMContentLoaded', async () =>
{
    // Set the theme to the user's preference
    document.documentElement.dataset['theme'] = localStorage.theme || 'dark'

    const forceLoad = (Boolean(localStorage['forceLoad'] || !1));

    // If the file icon map hasn't been loaded yet and the html
    // element has the load-icons attribute, load the file_icons.json file
    if ( typeof window.iconMap === 'undefined' && document.documentElement.dataset.hasOwnProperty('loadIcons') )
    {
        window['iconMap'] = await window.config.get('file_icons').then(res => JSON.parse(res));
    }

    // Check if there's language data in local storage
    // If not, load it from the language file.
    if ( !localStorage['language-data'] && !forceLoad )
        localStorage['language-data'] = await window.config.get('languages');

    __languages = JSON.parse(localStorage['language-data']);
    __languages = __languages[localStorage.language || (localStorage.language = 'english')] || __languages['english'];

    if ( !__languages )
        throw new Error('No languages found in languages file.');

    loadPageLanguages();

    if ( !localStorage['keybinds'] && !forceLoad )
        localStorage['keybinds'] = await window.config.get('keybinds');

    __keybinds = JSON.parse(localStorage['keybinds']);
})

/**
 * Function for getting the icon of a file based on its extension
 * @param {string} extension The extension of the file
 * @returns {string} The path to the icon
 */
window.resourceFromFileExtension = function (extension)
{
    // There is a possibility that the iconMap isn't loaded yet when this
    // function is called. In that case, return an empty string
    if ( !window.iconMap )
        return '';
    extension = extension.toLowerCase().replace(/(\s+)/g, '')
    let icon = findIconMapEntry(extension) || findIconMapEntry('unknown')
    // If there isn't a fallback icon named 'unknown' in the file_icons.json file, throw an error
    if ( !icon )
        throw new Error("Error loading icon map.")
    return '../resources/file_icons/' + icon['resource'];
}

/**
 * Function for finding the icon map entry based on an identifier (id or extension)
 * @param {string} identifier The identifier to search for
 * @returns {*}
 */
function findIconMapEntry(identifier)
{
    if ( !window.iconMap )
        return null
    return window.iconMap.find(icon => icon.id === identifier || icon.extensions.includes(identifier))
}

/**
 * Function for loading the languages from the languages.json file
 * and updating them onto the current page.
 */
function loadPageLanguages()
{
    // Go through all elements with 'data-lang', 'data-lang-title', 'data-lang-value', or 'data-lang-placeholder' attribute
    // and replace their properties with the corresponding language from the languages file
    document.querySelectorAll('*:is([data-lang], [data-lang-title], [data-lang-value], [data-lang-placeholder])')
        .forEach(element =>
        {
            [ [ 'lang', 'innerText' ], [ 'langTitle', 'title' ], [ 'langValue', 'value' ], [ 'langPlaceholder', 'placeholder' ] ]
                .forEach(([ data, attribute ]) =>
                {
                    // Check if the dataset attribute is present
                    if ( element.dataset[data] )
                        element[attribute] = __languages[element.dataset[data]] || element.dataset[data];
                })
        })
}

/* Upon keyup, reset all the key states. This prevents any keys from staying in the 'pressed' state */
window.addEventListener('keyup', _ => __keyStates = {});

/*
 * Upon keydown, set the key state to true for the pressed key
 */
window.addEventListener('keydown', (event) =>
{
    __keyStates[event.key.toLowerCase()] = true;
    // If it hasn't loaded yet, stop.
    if ( !__keybinds )
        return;
    Object.keys(__keybinds).forEach(keybind => __checkKeybindEntry(keybind, event));
});

/**
 * Function for checking a specific map of keybinds.
 * When all keys are pressed in the provided keybind map, the associated function is called
 * @param {string} keybindIdentifier The identifier of the keybind map to check.
 * @param {KeyboardEvent} event The fired press event
 * @private
 */
function __checkKeybindEntry(keybindIdentifier, event)
{
    if ( !__keybinds[keybindIdentifier] )
        return
    Object.entries(__keybinds[keybindIdentifier]['content'])
        .forEach(([ keybind, value ]) =>
        {
            if ( !value['combination'] ) // If there is no combination property, continue
                return

            // Combinations are separated by '|' in the keybinds.json file
            let combinations = value['combination'].split('|')
            for ( let combination of combinations )
            {
                let keys = combination.split('+').map(entry => entry.toLowerCase());
                if ( keys.length === 0 ) // skip empty combinations
                    continue

                // If the required keys aren't pressed, skip checking
                if ( !keys.every(isKeyPressed) )
                    continue;

                // Check if there aren't any other keys pressed
                if ( keys.length !== Object.keys(__keyStates).filter(key => __keyStates[key]).length )
                    continue;

                __fireKeybindEvent(keybind)
                event.preventDefault()
                event.stopPropagation()
                return;
            }
        })
}

/**
 * Function for firing a keybind event
 * @param {string} keybind The keybind map entry to fire the event for
 * @private
 */
function __fireKeybindEvent(keybind)
{
    for ( let keybindMapping of __keybindMappings )
        if ( keybindMapping[keybind] && typeof keybindMapping[keybind] === 'function' )
            keybindMapping[keybind]()
}

/**
 * Function for registering a set of keybind mappings.
 * Provided argument must be an object with keys of which the values are functions.
 * These functions will be called when the keybind combination, defined in 'keybinds.json'
 * are pressed. The keys in the provided object must match the one in the keybinds file.
 * @param {Object<Function>} keybinds
 */
function registerKeybindMapping(keybinds)
{
    __keybindMappings.push(keybinds)
}

/**
 * Function for checking if a key is pressed
 * @param {string} key The key to check
 * @returns {boolean} Whether the key is pressed
 */
function isKeyPressed(key)
{
    return __keyStates[key.toLowerCase()] || false
}

window.events.on('context-menu-interact', (event) =>
{
    console.log("Context menu interacted with", event)
})