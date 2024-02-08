const bladeCount = 8;
const rotateSpeed = 0.8;


/**
 *
 * @param {HTMLElement} container The container in which the spinner should be added.
 */
function addLoadingSpinner(container) {

    let spinner = document.createElement('div');
    for (let i = 0; i < bladeCount; i++) {
        let loadingSpinner = document.createElement('div');
        loadingSpinner.classList.add('spinner-blade');
        spinner.appendChild(loadingSpinner);
    }
    spinner.classList.add('spinner');
    container.appendChild(spinner);
}

(() => {
    // Check if the CSS styles data has been added to the document
    if (!document.getElementById('loading-spinner-styles')) {
        let styles = document.createElement('style');
        styles.id = 'loading-spinner-styles';
        styles.innerHTML = `
            .spinner { position: absolute; left: 0; right: 0; top: 0; bottom: 0; margin: auto; }
            .spinner-blade { 
                    position: absolute; left: 4px; bottom: 6px; width: 4px; height: 8px;
                    border-radius: 2px; background-color: transparent; transform-origin: center -0.2222em;
                    -webkit-animation: spinner-fade ${1/rotateSpeed}s infinite linear; animation: spinner-fade ${1/rotateSpeed}s infinite linear;
                }
             ${['@keyframes', '@-webkit-keyframes'].map(prefix => {
            return `${prefix} spinner-fade { 0% { background-color: #69717d; } 100% { background-color: transparent; }}` 
        })}
            ${Array(bladeCount).fill('').map((_, i) => {
            let angle = 360 / bladeCount * i;
            let delay = (1.0 / rotateSpeed) / bladeCount;
            return ` .spinner-blade:nth-child(${i + 1}) {
                    -webkit-animation-delay: ${i * delay}s;
                    animation-delay: ${i * delay}s;
                    transform: rotate(${angle}deg);
                }`
        }).join('')}`
        document.head.appendChild(styles);
    }

})();