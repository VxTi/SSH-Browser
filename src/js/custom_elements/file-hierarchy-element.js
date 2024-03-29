class FileHierarchyElement extends HTMLElement {

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

        this.#mainElement = document.createElement('div');
        this.#mainElement.classList.add('file-hierarchy-element');
        this.#mainElement.setAttribute('name', this.getAttribute('name'));
        this.#mainElement.setAttribute('type', this.getAttribute('type'));
        this.#mainElement.setAttribute('nesting-level', this.getAttribute('nesting-level'));
        this.#mainElement.setAttribute('path', this.getAttribute('path'));
        this.#mainElement.style.paddingLeft = `${parseInt(this.getAttribute('nesting-level')) * 10}px`;

        this.#fileIconElement = document.createElement('span');
        this.#fileIconElement.classList.add('file-hierarchy-element__icon', 'icon');
        this.#fileIconElement.style.backgroundImage = `url(${window.resourceFromFileExtension(this.getAttribute('type'))})`;

        this.#fileNameElement = document.createElement('span');
        this.#fileNameElement.classList.add('file-hierarchy-element__name');
        this.#fileNameElement.innerText = this.getAttribute('name');

        this.#mainElement.appendChild(this.#fileIconElement);
        this.#mainElement.appendChild(this.#fileNameElement);

        this.appendChild(this.#mainElement);
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
                    `url(${window.resourceFromFileExtension(newValue)})`;
            else if (name === 'nesting-level')
                this.querySelector('.file-hierarchy-element').style.paddingLeft = `${parseInt(newValue) * 10}px`;
        }
    }
}

window.customElements.define('file-hierarchy-element', FileHierarchyElement);