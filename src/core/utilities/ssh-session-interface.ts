/**
 * Definition of the SSHSession interface.
 */
export default interface ISSHSession {

    host: string;
    username: string;
    password?: string;
    port?: number;
    privateKey?: string;
    passphrase?: string;
}