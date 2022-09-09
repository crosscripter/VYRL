const spec = require('./spec')
const express = require('express')
const { log } = require('./logger')
const { produce } = require('./producer')
const { SERVER_HOST, SERVER_PORT } = require('./config')
const SERVER_URL = `${SERVER_HOST}:${SERVER_PORT}`

app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(express.static('./server/public'))
app.use('/edit', require('./editor'))
app.use('/tts', require('./reader'))

app.get('/', (_, res) => res.send(`<h1><tt>VYRL Server</tt></h1>`))

app.listen(3000, async () => {
  console.clear()
  log(`Server launched at ${SERVER_URL} 🚀`)
  await produce(spec)
})
