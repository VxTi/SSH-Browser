const fs = require('fs');
const path = require('node:path');

const SESSION_FILE_NAME = 'sessions.json';

let SESSION_FILE_PATH = null;

/**
 * Method for retrieving the successful sessions in sessions.json.
 * @returns {Promise<Object | Error>} A promise that resolves to the content of the sessions file.
 */
async function getSessions()
{
    return new Promise((resolve, reject) =>
    {
        if ( !SESSION_FILE_PATH )
            return reject(new Error('The path to the sessions file is not set.'));
        fs.readFile(SESSION_FILE_PATH, (err, data) =>
        {
            if ( err )
                return reject(err);

            let content = {};
            try
            {
                content = JSON.parse(data.toString());
            } catch (e)
            {
                return reject(new Error('Failed to parse JSON data from sessions file.'));
            }

            resolve(content);
        });
    });
}

/**
 * Method for updating the sessions file with a new successful connection.
 * @param {ISSHSession} session
 * The connection object to update the sessions file with.
 */
function pushSession(session)
{
    // Ensure that the session and the path to the sessions file are valid.
    if ( !session || !SESSION_FILE_PATH )
        return;
    // Get previous data
    fs.readFile(SESSION_FILE_PATH, (error, data) =>
    {
        if ( error )
        {
            console.error(error);
            throw error;
        }
        // Parse previous data
        let sessions = JSON.parse(data.toString());

        // Check if the connection is already in the sessions file, if not, add it.
        if ( !sessions.some(ses => ses.host === session.host && ses.username === session.username && ses.port === session.port) )
        {
            // Add new data
            sessions.push(session);

            // TODO: Encrypt the data before writing it to the file.

            // Write back to file
            fs.writeFile(SESSION_FILE_PATH, JSON.stringify(sessions), (err) =>
            {
                if ( err )
                {
                    console.error('An error occurred whilst attempting to write file:', err);
                    throw err;
                }
            })
        }
    })
}

/**
 * Method for deleting a session from the sessions file.
 * @param {ISSHSession} session The session to delete.
 */
function popSession(session)
{
    // Ensure that the session and the path to the sessions file are valid.
    if ( !session || !SESSION_FILE_PATH )
        return;
    fs.readFile(SESSION_FILE_PATH, (error, data) =>
    {
        if ( error )
            throw error;

        /** @type {ISSHSession[]} */
        let sessions = JSON.parse(data.toString());
        let index = sessions.findIndex(compare =>
        {
            return compare.host === session.host &&
                compare.username === session.username &&
                (compare?.port || 22) === (session?.port || 22);
        });
        if ( index !== -1 )
        {
            sessions.splice(index, 1);
            fs.writeFile(SESSION_FILE_PATH, JSON.stringify(sessions), (err) =>
            {
                if ( err ) throw err;
            })
        }
    })
}

/**
 * Method for ensuring the existence of the sessions file.
 */
function ensureSessionFileExistence(resourcePath)
{
    SESSION_FILE_PATH = path.join(resourcePath, SESSION_FILE_NAME);
    if ( !fs.existsSync(SESSION_FILE_PATH) )
        fs.writeFileSync(SESSION_FILE_PATH, '[]');
}

module.exports = { getSessions, pushSession, popSession, ensureSessionFileExistence };