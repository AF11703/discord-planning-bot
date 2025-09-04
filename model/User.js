const {model, Schema} = require('mongoose')

//TODO: Add encryption for refresh_token
const User = new Schema({
  discordId: {type: String, unique: true, required: true},
  refresh_token: {type: String}
})

module.exports = model('User', User)