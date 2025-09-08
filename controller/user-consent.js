const { getOAuth2Client } = require('../utility/auth')
const { saveUserCredentials } = require('../utility/db-tasks')

const authenticateUser = async (req, res) => {
    try {
        const {code, state} = req.query
        const oAuth2Client = getOAuth2Client()
        const {tokens} = await oAuth2Client.getToken(code)
        const {refresh_token} = tokens
        await saveUserCredentials(state, refresh_token)
        res.send('Authentication successful. Try adding event to Google Calendar again in Discord.')
    } catch(err) {
        console.error(err)
        res.send('An error occurred, please try again later')
    }
}

module.exports = authenticateUser