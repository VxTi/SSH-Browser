import NodeSSH from 'node-ssh';

const DEFAULT_READY_TIMEOUT: number = 1000;
const DEFAULT_PORT: number = 22;

/**
 * Definition of the SSHSession interface.
 */
export interface SSHSession {

    host: string;
    username: string;
    password?: string;
    port?: number;
    privateKey?: string;
    passphrase?: string;
    readyTimeout?: number;

}

/**
 * Class for managing an SSH session.
 */
export class SSHSession {

    /**
     * Creates a new SSHSession instance.
     * @param session The session to create.
     */
    constructor(session: SSHSession) {
        this.host = session.host;
        this.username = session.username;
        this.password = session.password;
        this.port = session.port || DEFAULT_PORT;
        this.privateKey = session.privateKey;
        this.passphrase = session.passphrase;
        this.readyTimeout = session.readyTimeout || DEFAULT_READY_TIMEOUT;
    }
}