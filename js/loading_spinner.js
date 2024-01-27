/**
 *
 * @param {HTMLElement} container The container in which the spinner should be added.
 */
function addLoadingSpinner(container) {
    let spinner = document.createElement('div');
    for (let i = 0; i < 12; i++) {
        let loadingSpinner = document.createElement('div');
        loadingSpinner.classList.add('spinner-blade');
        spinner.appendChild(loadingSpinner);
    }
    spinner.classList.add('spinner');
    container.appendChild(spinner);
}