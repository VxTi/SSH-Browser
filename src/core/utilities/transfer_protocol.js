/**
 * The TransferProtocol class is used to handle file transfers and connection status checks.
 * It uses private methods for file transfer, file retrieval, and connection status checking.
 * These methods are set using the respective setter methods.
 */
module.exports = class TransferProtocol {

    #fileTransferFn;
    #fileRetrievalFn;
    #connectionStatusFn;

    /**
     * Transfers a file to a specified destination.
     * @param {Object} file - The file to be transferred.
     * @param {string} destination - The destination where the file will be transferred.
     * @returns {any} The result of the file transfer function.
     */
    transferFile(file, destination)
    {
        return this.#fileTransferFn(file, destination);
    }

    /**
     * Retrieves a file from a specified destination.
     * @param {Object} file - The file to be retrieved.
     * @param {string} destination - The destination from where the file will be retrieved.
     * @returns {any} The result of the file retrieval function.
     */
    retrieveFile(file, destination)
    {
        return this.#fileTransferFn(file, destination);
    }

    /**
     * Checks the connection status.
     * @returns {any} The result of the connection status function.
     */
    isConnected()
    {
        return this.#connectionStatusFn();
    }

    /**
     * Sets the file transfer function.
     * @param {Function} fn - The function to be used for file transfers.
     */
    set fileTransferFn(fn)
    {
        this.#fileTransferFn = fn;
    }

    /**
     * Sets the file retrieval function.
     * @param {Function} fn - The function to be used for file retrievals.
     */
    set fileRetrievalFn(fn)
    {
        this.#fileRetrievalFn = fn;
    }

    /**
     * Sets the connection status function.
     * @param {Function} fn - The function to be used for checking connection status.
     */
    set connectionStatusFn(fn)
    {
        this.#connectionStatusFn = fn;
    }
}