# SSH SFTP - A File browser for SSH protocol.

An application written with ElectronJS and NodeJS.

To utilize this program, one has to first install all the necessary packages for NodeJS.
After first installing NodeJS (https://nodejs.org/en/download), one can then install
all the packages by running 'npm i' in the root directory of the project.
Once complete, one can compile the program using 'npm run build_(os)'

The build files can then be found in 'release-builds'.

## How to use the software 

Once successfully built, you'll find yourself on the homepage.
Here you can add a session you'd like to connect to. 
If you haven't added any yet, you can press the '+' button to add one to go to the login page.

Once on the login page, you can fill in the required credentials for the host you'd like to connect to.

This can be the username, specific port, private key or passphrase.

Once you've successfully connected to the host, you can browse your files remotely, add them, delete them or view them.

An example of how the pages look like can be found below.


## Example of the login page

![Login page](https://github.com/VxTi/SSH-FTP/blob/main/docs/ssh_ftp_login.png)

## Example of the Sessions page

![Login page](https://github.com/VxTi/SSH-FTP/blob/main/docs/ssh_ftp_sessions.png)

## Example of the file viewing page

![Login page](https://github.com/VxTi/SSH-FTP/blob/main/docs/ssh_ftp_view_files.png)

---

Future functions will be:
- Run console commands remotely
- Execute scripts remotely
- Add different file viewing options

