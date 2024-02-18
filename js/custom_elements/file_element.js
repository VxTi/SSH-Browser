/**
 * Implementation of the file-element custom element.
 *
 * @author Luca Warmenhoven
 * @date 16/02/2024
 */
class FileElement extends HTMLElement
{

    /** @type boolean */
    #directory
    /** @type string */
    #fileType

    _dropTarget = null

    static #defaultSize = '50px';

    constructor()
    {
        super();
        let shadowRoot = this.attachShadow({mode: 'open'});

        let styles = document.createElement('style');
        styles.textContent = `
            .file {
                display: flex;
                width: calc(1.5 * ${FileElement.#defaultSize});
                flex-flow: column nowrap;
                align-items: center;
                color: var(--text-color--, #fff);
                font-family: var(--font--, Arial);
                margin: 10px;
                
            }
            file-element[selected=""] .file {
                background-color: var(--selected-color--, #000);
                padding: 40px;
            }
            .file-icon {
                display: flex;
                flex-flow: column nowrap;
                justify-content: center;
                align-items: center;
                width: ${FileElement.#defaultSize};
                height: ${FileElement.#defaultSize};
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;   
            }   
            .file-name { text-align: center; margin: 10px; font-size: 0.8rem; }
        `
        let mainElement = document.createElement('div');
        mainElement.classList.add('file');
        mainElement.draggable = true;

        let fileIcon = document.createElement('div');

        fileIcon.classList.add('file-icon');

        // Add the file name to the file element
        let fileTitle = document.createElement('span');
        fileTitle.classList.add('file-name');

        this.addEventListener('dragstart', this._dragStart.bind(this));
        this.addEventListener('dragend', this._dragEnd.bind(this));
        this.addEventListener('dragover', this._dragOver.bind(this));
        this.addEventListener('drop', this._drop.bind(this));
        this.addEventListener('dragleave', this._dragLeave.bind(this));


        mainElement.appendChild(fileIcon);
        mainElement.appendChild(fileTitle);
        shadowRoot.appendChild(mainElement);
        shadowRoot.appendChild(styles);
    }

    /**
     * Getter for whether this file is a directory
     * @returns {boolean}
     */
    get directory()
    {
        return this.hasAttribute('directory');
    }

    /**
     * Static method for telling the DOM which attributes will be observed
     * in the 'attributeChangedCallback' method.
     * @returns {string[]} Array containing the names of the attributes to be observed.
     */
    static get observedAttributes()
    {
        return ['name', 'type', 'path', 'executable', 'selected'];
    }

    /**
     * Callback for when the element has been loaded into the DOM.
     */
    connectedCallback()
    {
        this.shadowRoot.querySelector('.file-name').innerText = this.getAttribute('name');
        this.#directory = this.hasAttribute('directory');
        this.#fileType = this.getAttribute('type');
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
        switch (name)
        {
            case 'name':
                this.shadowRoot.querySelector('.file-name').innerText = (newValue);
                break;
            case 'type':
                this.#setThumbnail(newValue);
                break;
        }
    }

    /**
     * Method for updating the thumbnail of the file element.
     * @param {string} extension The file extension of the file.
     */
    #setThumbnail(extension)
    {
        let fileIcon = this.shadowRoot.querySelector('.file-icon');
        fileIcon.style.backgroundImage = `url(${window.getIcon(extension)})`;
    }

    /**
     * Event handler for when the file element is being dragged.
     * @param {DragEvent} event
     * @private
     */
    _dragStart(event)
    {
        this.setAttribute('dragging', '');
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
        // Check if the element it's dragging over has the 'directory' attribute and if it's not already dragging
        if (this.hasAttribute('directory') && !this.hasAttribute('dragging'))
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
            let targetPath = this.getAttribute('path') + '/' + this.getAttribute('name')    ;
            window.ssh.moveFile(sourceName, sourcePath, targetPath)
                .then(() => sourceDragTarget.remove()) // Remove the source element
                .catch(console.error);
        }

        this.removeAttribute('dragover');
        event.preventDefault();
    }
}

window.customElements.define('file-element', FileElement);