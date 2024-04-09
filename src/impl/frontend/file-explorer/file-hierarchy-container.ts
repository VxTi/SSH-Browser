/**
 * @fileoverview This file contains the implementation of the file hierarchy container element.
 */
import { FileHierarchyElement } from "../custom-elements/file-explorer/file-hierarchy-element";

export function createContainer(mainComponent: FileHierarchyElement, childComponents: FileHierarchyElement[]): HTMLElement
{
    let container = document.createElement('div');

    container.setAttribute('path', mainComponent.getAttribute('path'));
    container.setAttribute('expanded', 'false');
    container.classList.add('file-hierarchy-file-container');

    container.addEventListener('dragover', _ =>
        container.setAttribute('drag-over', ''))

    container.addEventListener('dragleave', _ =>
        container.removeAttribute('drag-over'));

    container.addEventListener('drop', _ =>
    {
        container.removeAttribute('drag-over');
        window.dispatchEvent(new CustomEvent('file-dropped', {
            detail: {
                path: mainComponent.getAttribute('path'),
            }
        }));
    });

    container.appendChild(mainComponent);

    container.addEventListener('click', _ => {
        let shouldExpand = container.getAttribute('expanded') === 'false';
        container.setAttribute('expanded', shouldExpand.toString());

        let actionFn = shouldExpand ? 'appendChild' : 'removeChild';
        childComponents.forEach(child => container[actionFn](child));
    })

    return container;
}