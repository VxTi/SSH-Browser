# SSH SFTP - A File browser for SSH protocol.

An application written with ElectronJS and NodeJS.

To utilize this program, one has to first install all the necessary packages for NodeJS.
After first installing NodeJS (https://nodejs.org/en/download), one can then install
all the packages by running 'npm i' in the root directory of the project.
Once complete, one can compile the program using 'npm run build_(os)'

The build files can then be found in 'release-builds'.

> <b>NOTE:</b> This application currently only has support for Unix based SSH servers.
> Future compatibility with Windows servers is planned.

## How to use the software 

Once successfully built, you'll find yourself on the homepage.
Here you can add a session you'd like to connect to. 
If you haven't added any yet, you can press the '+' button to add one and go to the login page.

Once on the login page, you can fill in the required credentials for the host you'd like to connect to.

This can be the username, specific port, private key or passphrase.

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

