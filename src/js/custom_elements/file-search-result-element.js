class FileSearchResultElement extends HTMLElement {

    constructor()
    {
        super();
    }

    connectedCallback()
    {
        this.innerHTML = `
            <div class="file-search-result">
                <span class="element-icon" style="background-image: url(${window.resourceFromFileExtension(this.getAttribute('type'))});"></span>
                <span class="element-title">${this.getAttribute('name')}</span>
            </div>
        `;
        console.log(this.innerHTML);
        this.addEventListener('click', this._onClick.bind(this));
    }


    _onClick()
    {
        let event = new CustomEvent('file-search-result-click', {
            bubbles: true,
            detail: {
                path: this.getAttribute('path') + '/' + this.getAttribute('name'),
                type: this.getAttribute('type'),
                name: this.getAttribute('name')
            }
        });
        this.dispatchEvent(event);
    }

}

window.customElements.define('file-search-result', FileSearchResultElement);