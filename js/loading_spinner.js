const bladeCount = 8;


/**
 *
 * @param {HTMLElement} container The container in which the spinner should be added.
 */
function addLoadingSpinner(container) {

    let spinner = document.createElement('div');
    for (let i = 0; i < bladeCount; i++) {
        let loadingSpinner = document.createElement('div');
        loadingSpinner.classList.add('blade');
        spinner.appendChild(loadingSpinner);
    }
    spinner.classList.add('spinner');
    container.appendChild(spinner);
}