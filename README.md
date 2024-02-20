# SSH SFTP - A File browser for SSH protocol.

An application written with ElectronJS and NodeJS.

To access the latest release of this application, one can head to the 'Actions' tab and download the latest release.
If you don't want to download the latest release and you're willing to go more experimental, 
you can also build the application yourself.

To do this, you will need to have the NodeJS installed.
This can be found on the following page: 
>https://nodejs.org/en/download/

After installation, you'll have to clone this repository in a desired location
using the following command:
```bash
cd /path/to/your/desired/location
git clone https://github.com/VxTi/SSH-FTP.git
```

Once successfully cloned, you will have to execute the following commands to install all the
required node modules and build the application.

```bash
npm run build_{{PLATFORM}}
```
Where {PLATFORM} is the platform you'd like to build the application for.
This can be `linux`, `win` or `mac`.

The build files can then be found in the `release-builds` folder.

> **NOTE:** This application currently only has support for Linux based SSH servers.
> Future compatibility with Windows servers is planned.

## How to use the software 

Once successfully built or downloaded, you'll find yourself on the homepage.
Here you can add a session you'd like to connect to. 
If you haven't added any yet, you can press the '+' button to add one and go to the login page.

Once on the login page, you can fill in the required credentials for the host you'd like to connect to.

This can be the host, username, specific port, private key or passphrase.
These values depend on the server you're trying to connect to. If you don't know
all the required values, you might have to contact the server administrator(s).

Once you've successfully connected to the host, you can browse your files remotely, add them, delete them or view them.

An example of how the pages look like can be found below.

## Example of the Sessions page

<img alt="Login page" src="https://github.com/VxTi/SSH-FTP/blob/main/docs/ssh_ftp_sessions.png" width="500"/>

## Example of the login page

<img alt="Login page" src="https://github.com/VxTi/SSH-FTP/blob/main/docs/ssh_ftp_login.png" width="500"/>

## Example of the file viewing page

<img alt="Login page" src="https://github.com/VxTi/SSH-FTP/blob/main/docs/ssh_ftp_view_files.png" width="500"/>

---

Future functions will be:

> Execute scripts remotely, and view the output (If supported by server)
> 
> Add different file viewing options
> 
> Add a file preview / editor
> 
> Add local IDE support (Opening the files in your IDE)

