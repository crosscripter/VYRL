const spec = require('./spec')
const express = require('express')
const { log } = require('./logger')
const { SERVER_HOST, SERVER_PORT } = require('./config')

const SERVER_URL = `${SERVER_HOST}:${SERVER_PORT}`

app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(express.static('./server/public'))
app.get('/', (_, res) => res.send(`<h1><tt>VYRL Server</tt></h1>`))

app.listen(3000, async () => {
  console.clear()
  log(`Server launched at ${SERVER_URL} 🚀`)

  // const { produceRainVideo } = require('./producer')
  // await produceRainVideo(spec)

  const { overlay } = require('./editor/ffmpeg')

  log('Overlaying subscribe animation')
  await overlay(
    './server/public/assets/videos/countdown.mp4',
    'C:/users/cross/Code/VYRL/server/public/assets/subscribe.mp4'
  )
  log('done')
})
