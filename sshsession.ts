import { NodeSSH } from 'node-ssh';

module.exports = class SSHSession {

    private ssh: NodeSSH;

    /**
     * Constructor for creating a new SSH session instance.
     */
    constructor() {
        this.ssh = new NodeSSH();
    }

    /**
     * Connect to a remote host via SSH
     * @param host The address of the SSH server
     * @param username The username of the SSH user
     * @param password The password of the SSH user
     */
    async connect(host: string, username: string, password: string) {
        return await this.ssh.connect({
            host: host,
            username: username,
            password: password
        });
    }

    /**
     * Connect to a remote host via SSH using a private key
     * @param host
     * @param username
     * @param privateKey
     * @param passphrase
     */
    async connectKey(host: string, username: string, privateKey: string, passphrase: string) {
        return await this.ssh.connect({
            host: host,
            username: username,
            privateKey: privateKey,
            passphrase: passphrase
        });
    }

    /**
     * Execute a command on the remote host
     * @param command The command to be executed
     */
    async execute(command: string) {
        return await this.ssh.execCommand(command);
    }

    /**
     * Disconnect from the remote host
     */
    disconnect() {
        this.ssh.dispose();
    }

}