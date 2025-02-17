import { findIconMapEntry, resourceFromFileExtension } from '../../core-functionality.ts';
/**
 * Implementation of the file-element custom element.
 *
 * @author Luca Warmenhoven
 * @date 16/02/2024
 */
export class FileElement extends HTMLElement
{
    static #defaultSize = '50px';
    static #containerHeight = '25px'

    constructor()
    {
        super();
    }

    /**
     * Static method for telling the DOM which attributes will be observed
     * in the 'attributeChangedCallback' method.
     * @returns {string[]} Array containing the names of the attributes to be observed.
     */
    static get observedAttributes()
    {
        return [
            'name', 'type', 'path', 'path-segment'
        ];
    }

    /**
     * Callback for when the element has been loaded into the DOM.
     */
    connectedCallback()
    {
        const shadow = this.attachShadow({mode: 'open'});
        let styles = document.createElement('style');
        styles.textContent =
           `.center {display: flex;flex-flow: column nowrap;align-items: center;justify-content: center;}
            .file {color: var(--text-color, #fff);font-family: var(--font, Arial);width: calc(1.5 * ${FileElement.#defaultSize});margin: 5px;cursor: pointer;flex-shrink: 1 0 auto;}
            .file-icon {background-size: contain;background-repeat: no-repeat;background-position: center;width: ${FileElement.#defaultSize};height: ${FileElement.#defaultSize};}
            .file.path-segment {flex-flow: row nowrap;justify-content: flex-start;height: ${FileElement.#containerHeight};width: max-content; margin: 0 2px; }
            .file.path-segment .file-icon {width: ${FileElement.#containerHeight};height: ${FileElement.#containerHeight};}
            .file-name { text-align: center; margin: 5px; font-size: 0.8rem; overflow-wrap: anywhere;}
            .file.path-segment .file-name { overflow-wrap: break-word; }`

        let mainElement = document.createElement('div');
        mainElement.classList.add('center', 'file');
        mainElement.draggable = !this.hasAttribute('non-draggable') && !this.hasAttribute('path-segment');
        mainElement.title = this.getAttribute('name');
        if (this.hasAttribute('path-segment'))
            mainElement.classList.add('path-segment')

        if ((findIconMapEntry(this.getAttribute('type')) || {})['id'] === 'executable')
            this.setAttribute('executable', '')

        let fileIcon = document.createElement('div');
        fileIcon.classList.add('center', 'file-icon');
        fileIcon.style.backgroundImage = `url(${resourceFromFileExtension(this.getAttribute('type'))})`

        // Add the file name to the file element
        let fileTitle = document.createElement('span');
        fileTitle.classList.add('file-name');
        fileTitle.innerText = this.hasAttribute('nick-name') ?
            this.getAttribute('nick-name') : this.getAttribute('name') || '';

        if (!this.hasAttribute('path-segment') && !this.hasAttribute('nick-name'))
            fileTitle.innerText = this.#formatName(this.getAttribute('name'));

        this.addEventListener('dragstart', this._dragStart.bind(this));
        this.addEventListener('dragend', this._dragEnd.bind(this));
        this.addEventListener('dragover', this._dragOver.bind(this));
        this.addEventListener('drop', this._drop.bind(this));
        this.addEventListener('dragleave', this._dragLeave.bind(this));

        mainElement.appendChild(fileIcon);
        mainElement.appendChild(fileTitle);
        shadow.appendChild(mainElement);
        shadow.appendChild(styles);
    }

    /**
     * Callback for when an attribute has changed
     */
    attributeChangedCallback(name, oldValue, newValue)
    {
        if (!this.isConnected)
            return;

        switch (name)
        {
            case 'name':
                this.shadowRoot.querySelector('.file-name').innerText = newValue;
                break;
            case 'type':
                this.#setThumbnail(newValue);
                break;
            case 'path-segment':
                this.shadowRoot.querySelector('.file').classList.add('path-segment');
                break;
        }
    }


    /**
     * Method for formatting file names.
     * This is used for when file names are too long to be displayed on the screen.
     * @param {string} name The name of the file to be formatted.
     * @param {number} maxLength The maximum length of the file name. Default is 20.
     */
    #formatName(name, maxLength= 12) {
    if (name.length > maxLength) {
        let extensionIndex = name.indexOf('.');
        if (extensionIndex < 0) // Directory ?
            return name.substring(0, maxLength - 3) + '...';

        return name.substring(0, maxLength - 4) + '...' + name.substring(extensionIndex);
    }
    return name;
}

    /**
     * Method for updating the thumbnail of the file element.
     * @param {string} extension The file extension of the file.
     */
    #setThumbnail(extension)
    {
        this.shadowRoot.querySelector('.file-icon')
            .style.backgroundImage = `url(${resourceFromFileExtension(extension)})`;
    }

    /**
     * Event handler for when the file element is being dragged.
     * @param {DragEvent} event
     * @private
     */
    _dragStart(event)
    {
        this.setAttribute('dragging', '');
        event.dataTransfer.setDragImage(this.shadowRoot.querySelector('.file-icon'), 0, 0);
    }

    /**
     * Event handler for when the file element dragging has stopped
     * @param {DragEvent} event
     * @private
     */
    _dragEnd(event)
    {
        event.preventDefault()
        this.removeAttribute('dragging');
    }

    /**
     * Event handler for when the file element is being dragged over
     * @param {DragEvent} event
     * @private
     */
    _dragOver(event)
    {
        event.preventDefault();
        event.stopImmediatePropagation();
        event.dataTransfer.dropEffect = 'none';

        let sourceDragTarget = document.querySelector('[dragging]');

        if (!sourceDragTarget)
            return;

        let sourcePath = sourceDragTarget.getAttribute('path') + '/' + sourceDragTarget.getAttribute('name')
        let targetPath = this.getAttribute('path') + '/' + this.getAttribute('name')

        // If it's a path segment, we have to check paths differently.
        // Wouldn't wanna drag a file in a directory it's already in...
        if (this.hasAttribute('path-segment') && sourceDragTarget.getAttribute('path')
            === this.getAttribute('path') + '/' + this.getAttribute('name'))
            return;

        if (this.hasAttribute('directory') && !this.hasAttribute('dragging')
            && sourcePath !== targetPath && sourceDragTarget instanceof FileElement)
        {
            this.setAttribute('dragover', '')
            event.dataTransfer.dropEffect = 'copy'
        }
    }

    /**
     * Event handler for when the file element is being dragged out of the element
     * @param {DragEvent} event
     * @private
     */
    _dragLeave(event)
    {
        this.removeAttribute('dragover');
        event.preventDefault();
    }

    /**
     * Event handler for when the file element is being dropped
     * @param {DragEvent} event
     * @private
     */
    _drop(event)
    {
        let sourceDragTarget = document.querySelector('[dragging]');
        if (sourceDragTarget instanceof FileElement) {
            let sourceName = sourceDragTarget.getAttribute('name');
            let sourcePath = sourceDragTarget.getAttribute('path');
            let targetPath = this.getAttribute('path') + '/' + this.getAttribute('name');
            window['app']['logger'].log('Moving file from', sourcePath, 'to', targetPath)
            window.ssh.moveFile(sourceName, sourcePath, targetPath)
                .then(() => sourceDragTarget.remove()) // Remove the source element
                .catch(console.error);
        }

        this.removeAttribute('dragover');
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}

window.customElements.define('file-element', FileElement);