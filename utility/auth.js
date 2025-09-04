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


module.exports = {
  getOAuth2Client,
  getAuthUrl
}