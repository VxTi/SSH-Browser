/**
 * Implementation of the file-element custom element.
 *
 * @author Luca Warmenhoven
 * @date 16/02/2024
 */
class FileElement extends HTMLElement {

    /** @type boolean */
    #directory
    /** @type string */
    #fileType

    static #defaultWidth = '50px';
    static #defaultHeight = '50px';

    static #resourceLocation = '../assets/file_icons/';

    constructor() {
        super();
        let shadowRoot = this.attachShadow({mode: 'open'});

        let styles = document.createElement('style');
        styles.textContent = `
            .file {
                display: flex;
                flex-flow: column nowrap;
                align-items: center;
                color: var(--text-color--, #fff);
                font-family: var(--font--, Arial);
            }
            .file[selected] {
                background-color: var(--highlight-color--, #000);
            }
            .file-icon {
                display: flex;
                flex-flow: column nowrap;
                justify-content: center;
                align-items: center;
                width: ${FileElement.#defaultWidth};
                height: ${FileElement.#defaultWidth};
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
        mainElement.appendChild(fileIcon);
        mainElement.appendChild(fileTitle);
        shadowRoot.appendChild(mainElement);
        shadowRoot.appendChild(styles);

    }

    /**
     * Getter for whether this file is a directory
     * @returns {boolean}
     */
    get directory() {
        return this.hasAttribute('directory');
    }

    /**
     * Static method for telling the DOM which attributes will be observed
     * in the 'attributeChangedCallback' method.
     * @returns {string[]} Array containing the names of the attributes to be observed.
     */
    static get observedAttributes() {
        return ['name', 'type', 'path', 'executable', 'selected'];
    }

    /**
     * Callback for when the element has been loaded into the DOM.
     */
    connectedCallback() {
        this.shadowRoot.querySelector('.file-name').innerText = this.getAttribute('name');
        this.#directory = this.hasAttribute('directory');
        this.#fileType = this.getAttribute('type');
        this.#setThumbnail(this.#fileType);
    }

    /**
     * Callback for when the element has been removed from the DOM.
     */
    disconnectedCallback() {

    }

    /**
     * Callback for when an attribute has changed
     */
    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
            case 'name':
                this.shadowRoot.querySelector('.file-name').innerText = (newValue);
                break;
            case 'type': this.#setThumbnail(newValue); break;
        }
    }

    #setThumbnail(extension)
    {
        let newType = window.iconMap?.find(icon => icon.extensions.includes(extension));
        if (newType) {
            let fileIcon = this.shadowRoot.querySelector('.file-icon');
            fileIcon.style.backgroundImage = `url(${FileElement.#resourceLocation + newType.resource})`;
        } else {

        }
    }
}

window.customElements.define('file-element', FileElement);