import {resourceFromFileExtension} from "../general-functionality.js";

/**
 * Custom element for displaying a file search result,
 * in the file search results list.
 */
export class FileSearchResultElement extends HTMLElement {

    constructor()
    {
        super();
    }

    connectedCallback()
    {
        this.innerHTML = `
            <div class="file-search-result">
                <span class="element-icon" style="background-image: url(${resourceFromFileExtension(this.getAttribute('type'))});"></span>
                <span class="element-title">${this.getAttribute('name')}</span>
            </div>
        `;
        console.log(this.innerHTML);
    }
}

window.customElements.define('file-search-result', FileSearchResultElement);