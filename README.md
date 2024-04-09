# SSH SFTP - A File browser for SSH protocol.

An application written with ElectronJS and NodeJS.

To access the latest release of this application, one can head to the 'Actions' tab and download the latest release.
If you don't want to download the latest release, and you're willing to go more experimental, 
you can also build the application yourself.

To do this, you will need to have Node.js and git installed.

Installation of Node.js can be found on the following page: 
> https://nodejs.org/en/download/

Installation of Git can be found on the following page ( If you're not running a Debian based system ):
> https://git-scm.com/downloads

Or if you're running a Debian based system, you can install NPM and Node.js using the following command:

```bash
sudo apt install nodejs
sudo apt install npm
```

---

Once you have the required software installed, you'll have to clone this repository in a desired location
using the following command:
```bash
cd /path/to/your/desired/location
git clone https://github.com/VxTi/SSH-FTP.git
```

Once successfully cloned, you will have to execute the following commands to install all the
required node modules and build the application.

```bash
PLATFORM="win" # or win or mac
npm run build_$PLATFORM
```
Where PLATFORM is the platform you'd like to build the application for.
This can be `linux`, `win` or `mac`.

The build files can then be found in the `release-builds` folder.

If you don't want to build it and just simply run it in development mode, you can use the following command:

```bash
npm run start
```

## How to use the software (With examples)

### The main page (Sessions)

This is the page where the user can add, join, or delete sessions.
These sessions can be made using the '+' button.
This takes the user to the login page, where the user can fill in the required credentials.
An example of the login page can be found below.

<img alt="Login page" src="https://github.com/VxTi/SSH-FTP/blob/main/docs/main-page.png" width="500"/>

### The login page

The login page is where the user can fill in the required credentials to connect to the server.
These credentials can be the host, username, port, private key, and passphrase.
The user can also choose to enable fingerprint authentication ( macOS only )
This is a security feature that allows the user to verify the server's fingerprint before connecting.

<img alt="Login page" src="https://github.com/VxTi/SSH-FTP/blob/main/docs/login-page.png" width="500"/>

### The file explorer

This is the page where the user can view the files on the server,
add, delete, or edit files. One can also choose to open the terminal
to execute commands on the server.

<img alt="Login page" src="https://github.com/VxTi/SSH-FTP/blob/main/docs/file-explorer.png" width="500"/>

### The built-in file editor

This is the window where the user can edit the files on the server.
This is a simple text editor that allows the user to edit the files.
The user can also save the file, or cancel the editing.

**Note**: This editor is still in development and might not work as expected.

<img alt="File editing" src="https://github.com/VxTi/SSH-FTP/blob/main/docs/file-editor.png" width="500"/>

### The terminal window

This is the window where the user can execute commands on the server.
Currently still in development; there might still be bugs present.

<img alt="SSH Terminal" src="https://github.com/VxTi/SSH-FTP/blob/main/docs/terminal.png" width="500"/>

---

### Future functions and compatibility

Planned features to implement in the future are:

> - Execute scripts remotely, and view the output (If supported by server)
> - Add different file viewing options
> - Add a file preview / editor ( Currently in development )
> - Add local IDE support (Opening the files in your IDE) ( Currently in development )
> - Add custom themes
> - Add support for Windows servers


> ### Important Notice
> This application currently only has support for Linux based SSH servers.
> Future compatibility with Windows servers is planned.