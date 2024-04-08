export class CircularLoadingElement extends HTMLElement
{
    /**
     * Constructor for the circular loading element.
     */
    constructor() { super(); }

    /**
     * Handler for when the element is connected to the DOM.
     */
    connectedCallback()
    {
        let containerElement = document.createElement('div');
        containerElement.classList.add('circular-loader-container');

        for ( let i = 0; i < 8; i++ )
        {
            let rotorElement = document.createElement('div');
            rotorElement.classList.add('circular-loader-rotor');
            rotorElement.style.animationDelay = `${i * 0.125 }s`;
            rotorElement.style.transform = `rotate(${360 / 8 * i}deg) translateX(70%) `;
            containerElement.appendChild(rotorElement);
        }

        this.innerHTML = containerElement.outerHTML;
    }
}

customElements.define('circular-loader', CircularLoadingElement);