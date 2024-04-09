import { resourceFromFileExtension } from "../../core-functionality";

/**
 * A custom element that represents a file in the file hierarchy.
 */
export class FileHierarchyElement extends HTMLElement
{

    private mainElement: HTMLElement;
    private fileIconElement: HTMLElement;
    private fileNameElement: HTMLElement;
    private initialized: boolean = false;

    /**
     * Constructor for easily generating a file hierarchy element.
     */
    constructor()
    {
        super();
    }

    /**
     * The observed attributes of the file hierarchy element.
     * @returns {string[]} The observed attributes.
     */
    static get observedAttributes()
    {
        return [
            'name', 'type'
        ];
    }

    connectedCallback()
    {
        const shadow = this.attachShadow({ mode: 'open' });

        let styles = document.createElement('style');
        styles.textContent =
            `
                .main { height: var(--file-hierarchy-element-size); min-width: var(--file-hierarchy-width); 
                width: 100%; display: flex; flex-flow: row nowrap; justify-content: flex-start; align-items: center; }
                .text { color: var(--text-color); font-family: var(--font); font-size: 0.8rem; margin-right: 10px; margin-left: 10px; }
                .icon { background-size: contain; background-repeat: no-repeat; background-position: center;                 margin-left: 10px;
                    width: calc(var(--file-hierarchy-element-size) - 2 * var(--file-hierarchy-element-margin));
                    height: calc(var(--file-hierarchy-element-size) - 2 * var(--file-hierarchy-element-margin)); }
                .nest { height: var(--file-hierarchy-element-size); width: 15px; }
            `;

        shadow.appendChild(styles);

        this.mainElement = document.createElement('div');
        this.mainElement.classList.add('main');
        this.mainElement.setAttribute('name', this.getAttribute('name'));
        this.mainElement.setAttribute('type', this.getAttribute('type'));
        this.mainElement.setAttribute('nesting-level', this.getAttribute('nesting-level'));
        this.mainElement.setAttribute('path', this.getAttribute('path'));

        this.fileIconElement = document.createElement('span');
        this.fileIconElement.classList.add('icon');
        this.fileIconElement.style.backgroundImage = `url(${resourceFromFileExtension(this.getAttribute('type'))})`;

        for ( let i = 0; i < parseInt(this.getAttribute('nesting-level')) || 0; i++ )
        {
            let nestingElement = document.createElement('span');
            nestingElement.classList.add('nest');
            nestingElement.setAttribute('nesting-level', i.toString());
            this.mainElement.appendChild(nestingElement);
        }

        this.fileNameElement = document.createElement('span');
        this.fileNameElement.classList.add('text');
        this.fileNameElement.innerText = this.getAttribute('name');

        this.mainElement.appendChild(this.fileIconElement);
        this.mainElement.appendChild(this.fileNameElement);

        shadow.appendChild(this.mainElement);
        this.initialized = true;
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string)
    {
        if ( !this.initialized )
            return;
        if ( oldValue !== newValue )
        {
            this.querySelector('.file-hierarchy-element').setAttribute(name, newValue);
            if ( name === 'name' )
            {
                (this.querySelector('.file-hierarchy-element__name') as HTMLElement).innerText = newValue;
            }
            else if ( name === 'type' )
            {
                (this.querySelector('.file-hierarchy-element__icon') as HTMLElement)
                    .style.backgroundImage = `url(${resourceFromFileExtension(newValue)})`;
            }
        }
    }
}

window.customElements.define('file-hierarchy-element', FileHierarchyElement);