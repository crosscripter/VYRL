require('dotenv').config()
const express = require('express')
const { log } = require('./logger')

app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const { SERVER_HOST, SERVER_PORT } = process.env
const SERVER_URL = `${SERVER_HOST}:${SERVER_PORT}`

app.use('/pexels', require('./pexels'))
app.use('/editor', require('./editor'))

app.get('/', (_, res) => res.send(`<h1><tt>VYRL Server</tt></h1>`))

app.listen(3000, () => {
  console.clear()
  log(`Server launched at ${SERVER_URL} 🚀`)
})
