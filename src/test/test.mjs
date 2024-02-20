'use strict'

export default class Test {

    #testFn;
    /** @type {'success' | 'failed' | 'not-tested'} */
    #testStatus = 'not-tested';
    #testName;
    #output;
    #arguments;
    #expected;

    #ansi = (rgb) => `\x1b[38;2;${(rgb >> 16) & 0xFF};${(rgb >> 8) & 0xFF};${rgb & 0xFF} m`;

    constructor(name, testFn) {
        this.#testFn = testFn;
        this.#testName = name;
    }

    /**
     * Expects an output from
     * @param expected
     * @param args
     */
    test(expected, ...args) {
        let out = (typeof this.#testFn === 'function' ? this.#testFn(...args) : this.#testFn)
        this.#testStatus = (expected === out) ? 'success' : 'failed'
        this.#output = out;
        this.#expected = expected;
        this.#arguments = args;
        return this;
    }

    /**
     * Retrieves the status of the test.
     * @returns {"success"|"failed"|"not-tested"}
     */
    status() {
        return this.#testStatus;
    }

    log() {
        console.log(`${this.#ansi(-1)}Test '${this.#testName}' returned with status${this.#testStatus === 'success' ? this.#ansi(0xff00) : this.#testStatus === 'failed' ? this.#ansi(0xff0000) : this.#ansi(0xffff00)}${this.#testStatus}${this.#ansi(-1)}(args: ${this.#arguments}, returned: ${this.#output})`);
    }
}