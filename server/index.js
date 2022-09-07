require('dotenv').config()
const express = require('express')
const { log } = require('./logger')
const { produce } = require('./producer')
const { thumbnail } = require('./editor/ffmpeg')

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

  return await thumbnail('assets/mtn.mp4', 'The BEST video ever!')

  await produce({
    duration: 30,
    captions: true,
    audio: {
      fade: true,
      theme: 'chill',
    },
    video: {
      fade: true,
      scale: true,
      watermark: true,
      theme: 'space planet galaxy stars',
      hashtags: '#music, #relax, #space, #stars',
    },
  })
})
