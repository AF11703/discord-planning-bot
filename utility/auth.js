const fsp = require('fs').promises
const fs = require('fs')
const path = require('path')
const { google } = require('googleapis')
const creds = require('../credentials.json')

function getOAuth2Client() {
  return new google.auth.OAuth2(
    creds.web.client_id,
    creds.web.client_secret,
    creds.web.redirect_uris[0]
  )
}

function getAuthUrl(userId) {
  const oAuth2Client = getOAuth2Client()
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ],
    state: userId
  })
}

//TODO: Change to use DB
async function loadUserCredentials(userId) {
  const tokenPath = path.join(__dirname, '../user-tokens', `${userId}.json`)
  if (!fs.existsSync(tokenPath)) {
    return null
  }
  try {
    const token = await fsp.readFile(tokenPath, 'utf-8')
    const oAuth2Client = getOAuth2Client()
    oAuth2Client.setCredentials(JSON.parse(token))
    return oAuth2Client
  } catch (err) {
    console.error(err)
    return null
  }
}

//TODO: Change to use DB
async function saveUserCredentials(userId, token) {
  const dirPath = path.join(__dirname, '../user-tokens')
  const tokenPath = path.join(dirPath, `${userId}.json`)
  await fsp.mkdir(dirPath, {recursive: true})
  await fsp.writeFile(tokenPath, JSON.stringify(token))
}
module.exports = {
  getOAuth2Client,
  loadUserCredentials,
  getAuthUrl,
  saveUserCredentials
}