/**
 * Implementation of the file-element custom element.
 *
 * @author Luca Warmenhoven
 * @date 16/02/2024
 */
class FileElement extends HTMLElement
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
            .file {color: var(--text-color--, #fff);font-family: var(--font--, Arial);min-width: calc(1.5 * ${FileElement.#defaultSize});margin: 5px;cursor: pointer;flex-shrink: 1 0 auto;}
            .file-icon {background-size: contain;background-repeat: no-repeat;background-position: center;width: ${FileElement.#defaultSize};height: ${FileElement.#defaultSize};}
            .file.path-segment {flex-flow: row nowrap;justify-content: flex-start;height: ${FileElement.#containerHeight};width: max-content; margin: 0 2px; }
            .file.path-segment .file-icon {width: ${FileElement.#containerHeight};height: ${FileElement.#containerHeight};}
            .file-name { text-align: center; margin: 5px; font-size: 0.8rem; overflow-wrap: anywhere;}
            .file.path-segment .file-name { overflow-wrap: break-word; }`

        let mainElement = document.createElement('div');
        mainElement.classList.add('center', 'file');
        mainElement.draggable = true;
        if (this.hasAttribute('path-segment'))
            mainElement.classList.add('path-segment')

        let fileIcon = document.createElement('div');
        fileIcon.classList.add('center', 'file-icon');
        fileIcon.style.backgroundImage = `url(${window.getIcon(this.getAttribute('type'))})`

        // Add the file name to the file element
        let fileTitle = document.createElement('span');
        fileTitle.classList.add('file-name');
        fileTitle.innerText = this.hasAttribute('nick-name') ?
            this.getAttribute('nick-name') : this.getAttribute('name') || '';

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
     * Callback for when the element has been removed from the DOM.
     */
    disconnectedCallback()
    {
        // TODO: Implement
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
     * Method for updating the thumbnail of the file element.
     * @param {string} extension The file extension of the file.
     */
    #setThumbnail(extension)
    {
        this.shadowRoot.querySelector('.file-icon')
            .style.backgroundImage = `url(${window.getIcon(extension)})`;
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
        let sourceDragTarget = document.querySelector('[dragging]');
        // Check if the element it's dragging over has the 'directory' attribute and if it's not already dragging
        if (this.hasAttribute('directory') && !this.hasAttribute('dragging')
            && sourceDragTarget instanceof FileElement && sourceDragTarget.getAttribute('path') !== this.getAttribute('path'))
        {
            this.setAttribute('dragover', '')
            event.dataTransfer.dropEffect = 'copy'
        } else {
            event.dataTransfer.dropEffect = 'none';
        }

        event.preventDefault();
        event.stopImmediatePropagation();
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
            let targetPath = this.getAttribute('path')
            console.log(`Moving ${sourceName} from ${sourcePath} to ${targetPath}`)
            window.ssh.moveFile(sourceName, sourcePath, targetPath)
                .then(() => sourceDragTarget.remove()) // Remove the source element
                .catch(console.error);
        }

        this.removeAttribute('dragover');
        event.preventDefault();
    }
}

window.customElements.define('file-element', FileElement);