import { resourceFromFileExtension } from "../general-functionality";

/**
 * A custom element that represents a file in the file hierarchy.
 */
export class FileHierarchyElement extends HTMLElement {

    #mainElement;
    #fileIconElement;
    #fileNameElement;
    #initialized = false;

    constructor()
    {
        super();
    }

    static get observedAttributes()
    {
        return [
            'name', 'type', 'path', 'nesting-level'
        ];
    }

    connectedCallback()
    {
        const shadow = this.attachShadow({mode: 'open'});

        let styles = document.createElement('style');
        styles.textContent =
            `
                .main { display: flex; flex-flow: row nowrap; justify-content: flex-start; align-items: center; color: bbb; }
            `;

        this.#mainElement = document.createElement('div');
        this.#mainElement.classList.add('file-hierarchy-element');
        this.#mainElement.setAttribute('name', this.getAttribute('name'));
        this.#mainElement.setAttribute('type', this.getAttribute('type'));
        this.#mainElement.setAttribute('nesting-level', this.getAttribute('nesting-level'));
        this.#mainElement.setAttribute('path', this.getAttribute('path'));

        this.#fileIconElement = document.createElement('span');
        this.#fileIconElement.classList.add('file-hierarchy-element__icon', 'icon');
        this.#fileIconElement.style.backgroundImage = `url(${resourceFromFileExtension(this.getAttribute('type'))})`;

        for (let i = 0; i < parseInt(this.getAttribute('nesting-level')) || 0; i++)
        {
            let nestingElement = document.createElement('span');
            nestingElement.classList.add('file-hierarchy-element__nesting');
            nestingElement.setAttribute('nesting-level', i);
            this.#mainElement.appendChild(nestingElement);
        }

        this.#fileNameElement = document.createElement('span');
        this.#fileNameElement.classList.add('file-hierarchy-element__name');
        this.#fileNameElement.innerText = this.getAttribute('name');

        this.#mainElement.appendChild(this.#fileIconElement);
        this.#mainElement.appendChild(this.#fileNameElement);

        shadow.appendChild(this.#mainElement);
        this.#initialized = true;
    }

    attributeChangedCallback(name, oldValue, newValue)
    {
        if (!this.#initialized)
            return;
        if (oldValue !== newValue)
        {
            this.querySelector('.file-hierarchy-element').setAttribute(name, newValue);
            if (name === 'name')
                this.querySelector('.file-hierarchy-element__name').innerText = newValue;
            else if (name === 'type')
                this.querySelector('.file-hierarchy-element__icon').style.backgroundImage =
                    `url(${resourceFromFileExtension(newValue)})`;
            else if (name === 'nesting-level')
                this.querySelector('.file-hierarchy-element').style.paddingLeft = `${parseInt(newValue) * 10}px`;
        }
    }
}

window.customElements.define('file-hierarchy-element', FileHierarchyElement);