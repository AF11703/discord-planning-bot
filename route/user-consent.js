const express = require('express')
const router = express.Router()

const authenticateUser = require('../controller/user-consent')

router.get('/', authenticateUser)

module.exports = router