/**
 * Interface for a context-menu item.
 */
interface IContextMenuItem
{
    title?: string;
    type: ContextMenuItemType;
    iconUrl?: string;
    checked?: boolean;
    enabled?: boolean;
    visible?: Function;
    click?: Function;
    submenu?: IContextMenuItem[];
}

// Object that holds the context menu configurations.
const contextMenuConfigurations: Record<string, IContextMenuItem[]> = {};


type ContextMenuItemType = 'normal' | 'separator' | 'submenu' | 'checkbox';

/**
 * Function for registering a context-menu.
 * @param name The name of the context menu
 * @param items The items that reside in the context menu.
 */
export function registerContextMenu(name: string, items: IContextMenuItem[]): void
{
    if ( contextMenuConfigurations.hasOwnProperty(name) )
    {
        console.warn(`The context-menu with the name '${name}' has already been registered.`);
        return;
    }
    contextMenuConfigurations[name] = items;
}

/**
 * Function for generating the context-menu elements.
 * @param name The name of the contextmenu to show. This has to be registered first.
 * @param mouseX The x-coordinate of the mouse.
 * @param mouseY The y-coordinate of the mouse.
 * @param parameters The parameters to pass to the context menu.
 */
export function showContextMenu(name: string, mouseX: number, mouseY: number, parameters?: any): void
{
    if ( !contextMenuConfigurations.hasOwnProperty(name) )
    {
        console.warn(`The context-menu with the name '${name}' has not been registered.`);
        return;
    }

    const items = contextMenuConfigurations[name];

    document.getElementById('context-menu')?.remove();

    const menu = document.createElement('div');
    menu.classList.add('context-menu', 'popup');
    menu.id = 'context-menu';
    menu.style.setProperty('--x', `${mouseX}px`);
    menu.style.setProperty('--y', `${mouseY}px`);

    // Generate menu items.
    for ( let item of items )
    {

        // If the item has a visibility function and it returns false, skip the item.
        if ( item.visible && !item.visible(parameters) )
            continue;

        const menuItem = document.createElement('div');
        menuItem.classList.add('context-menu-item', `context-menu-item__${item.type}`);

        if ( item.type !== 'separator' )
        {
            menuItem.setAttribute('visible', !item.visible ? 'false' :
                item.visible(parameters) === false ? 'false' : 'true');
            menuItem.textContent = item.title || '';
            menuItem.addEventListener('click', _ =>
            {
                if ( item.type === 'checkbox' )
                {
                    item.checked = !item.checked;
                    menuItem.setAttribute('checked', item.checked.toString());
                }
                if ( item.click )
                    item.click(parameters);
            });
        }

        menu.appendChild(menuItem);
    }
    document.body.appendChild(menu);
}

/**
 * Function for destroying the context menu.
 */
function destroyContextMenu(): void
{
    document.getElementById('context-menu')?.remove();
}

export default (() =>
{
    return {
        register: registerContextMenu,
        show: showContextMenu,
        destroy: destroyContextMenu
    };
})();