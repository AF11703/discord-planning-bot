const mongoose = require('mongoose')

//TODO: Determine encryption method (mongoose-encrpytion or CSFLE w/ Mongoose)
const User = new mongoose.Schema({
  discordId: {type: String, unique: true, required: true},
  token: {
    access_token: {type: String},
    refresh_token: {type: String},
    scope: {type: String},
    token_type: {type: String},
    expiry_date: {type: Number}
  }
})

module.exports = mongoose.model('User', User)