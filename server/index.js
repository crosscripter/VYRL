require('dotenv').config()
const express = require('express')
const { log } = require('./logger')
const { produce } = require('./producer')

app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const { SERVER_HOST, SERVER_PORT } = process.env
const SERVER_URL = `${SERVER_HOST}:${SERVER_PORT}`

app.use(express.static('./server/public'))
app.use('/edit', require('./editor'))
app.use('/tts', require('./reader'))
app.use('/video', require('./downloader/video'))
app.use('/audio', require('./downloader/audio'))

app.get('/', (_, res) => res.send(`<h1><tt>VYRL Server</tt></h1>`))

app.listen(3000, async () => {
  console.clear()
  log(`Server launched at ${SERVER_URL} 🚀`)

  await produce({
    duration: 60,
    video: { theme: 'city' },
    audio: { theme: 'upbeat' },
  })
})
