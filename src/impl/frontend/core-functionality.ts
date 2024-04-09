
let __keyStates: Object = {};
let __keybinds: Object = null;
let __keybindMappings: Object[] = [];

/**
 *  Once the page has successfully been loaded, we'll have
 *  to load all languages from the languages.json file and
 *  update them onto the page. We'll also have to set the
 *  theme to the user's preference, load the file_icons.json
 *  and load the keybinds from the keybinds.json file.
 */
document.addEventListener('DOMContentLoaded', async () =>
{

    document.body.classList.add(window['app'].os.platform);

    // Navigator bars are only used on macOS, since only
    // macOS can have borderless windows (electronJS)
    if ( window['app'].os.isMac )
    {
        let navigator = document.createElement('div');
        navigator.classList.add('navigator');
        document.body.prepend(navigator);
        let navigatorTitle = document.createElement('span');
        navigatorTitle.classList.add('navigator-title');
        navigatorTitle.innerText = 'SSH FTP';
        navigator.appendChild(navigatorTitle);
    }

    window['setTitle'] = function (title: string)
    {
        if ( window['app'].os.isMac )
            (document.querySelector('.navigator-title') as HTMLElement).innerText = title;
        else document.title = title;
    }

    const forceLoad = (Boolean(localStorage['forceLoad'] || !1));

    // If the file icon map hasn't been loaded yet and the html
    // element has the load-icons attribute, load the file_icons.json file
    if ( typeof window['iconMap'] === 'undefined' && document.documentElement.dataset.hasOwnProperty('loadIcons') )
    {
        window['iconMap'] = await window['app'].config.get('file_icons')
            .then(res => JSON.parse(res));
    }

    if ( !localStorage['keybinds'] && !forceLoad )
        localStorage['keybinds'] = await window['app'].config.get('keybinds');

    __keybinds = JSON.parse(localStorage['keybinds']);

    // Remove all popups from the screen once the window resizes.
    document.addEventListener('resize', _ =>
        document.querySelectorAll('.popup').forEach(popup => popup.remove()));
})

/**
 * Function for removing all popups from the screen
 */
export function clearPopups()
{
    document.querySelectorAll('.popup').forEach(popup => popup.remove());
}

/**
 * Function for getting the icon of a file based on its extension
 * @param extension The extension of the file
 * @returns The path to the icon
 */
export function resourceFromFileExtension(extension: string): string
{
    // There is a possibility that the iconMap isn't loaded yet when this
    // function is called. In that case, return an empty string
    if ( !window['iconMap'] )
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
 * @param identifier The identifier to search for
 * @returns The icon map entry
 */
export function findIconMapEntry(identifier: string): string | null
{
    if ( !window['iconMap'] )
        return null
    return window['iconMap'].find(icon => icon.id === identifier || icon.extensions.includes(identifier))
}

/** Upon keyup, reset all the key states. This prevents any keys from staying in the 'pressed' state */
window.addEventListener('keyup', _ => __keyStates = {});

/**
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
function __checkKeybindEntry(keybindIdentifier: string, event: KeyboardEvent)
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
function __fireKeybindEvent(keybind: string)
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
export function registerKeybindMapping(keybinds: Object)
{
    __keybindMappings.push(keybinds)
}

/**
 * Function for checking if a key is pressed
 * @param key The key to check
 * @returns Whether the key is pressed
 */
export function isKeyPressed(key: string)
{
    return __keyStates[key.toLowerCase()] || false
}

window['events'].on('context-menu-interact', (event: CustomEvent) =>
{
    console.log("Context menu interacted with", event)
})
