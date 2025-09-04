const User = require('../model/User')
const { getOAuth2Client } = require('./auth')

async function loadUserCredentials(userId) {
  const user = await User.findOne({discordId: userId}) //TODO: Read 'User.js'

  if (!user) {
    return null
  }

  const refreshToken = user.refresh_token
  try {
    const oAuth2Client = getOAuth2Client()
    oAuth2Client.setCredentials({refresh_token: refreshToken})
    return oAuth2Client
  } 
  catch (err) {
    console.error(err)
    return null
  }
}




async function saveUserCredentials(userId, refreshToken) {
  await User.findOneAndUpdate(
    {discordId: userId}, {discordId: userId, refresh_token: refreshToken}, {upsert: true}
  )
}

module.exports = {
  loadUserCredentials,
  saveUserCredentials
}