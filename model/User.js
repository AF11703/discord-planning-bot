const {model, Schema} = require('mongoose')
const { fieldEncryption } = require('mongoose-field-encryption')

const UserSchema = new Schema({
  discordId: {type: String, unique: true, required: true},
  refresh_token: {type: String}
})

UserSchema.plugin(fieldEncryption, {
  fields: ['refresh_token'],
  secret: process.env.ENC_KEY
})

const User = model('User', UserSchema)

module.exports = User