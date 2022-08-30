require('dotenv').config()
const express = require('express')
const { loop } = require('./editor/ffmpeg')
const { log } = require('./logger')
const { produce, generate, rainVideo, video } = require('./producer')

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

  // await produce({
  //   video: 'mtn.mp4',
  //   videoTitle: 'Drone Mountain Footage',
  //   videoCredits: 'Stephano Rinaldo',
  //   song: 'cinematic.mp3',
  //   songTitle: 'Cinematic Documentary',
  //   songCredits: 'Lexin_Music at Pixabay',
  //   transcript: `
  //   This is a test of the voiceover capabilities of the VIRAL Audio engine.
  //   This powerful text-to-speech engine can automatically generate MP3 audio tracks from textual input.
  //   Meaning, that the audio you are hearing right now, was produced entirely by code!
  //   `,
  // })

  // const visuals = 'beach'
  // const genre = 'ambient'

  // log(`Generating random video of a ${visuals} with ${genre} music...`)
  // await generate(visuals, genre)

  // await rainVideo()

  // await video({
  //   video: {
  //     file: 'waterfall.mp4',
  //     author: 'Engin Akyurt',
  //     title: 'Beauty of Waterfalls',
  //   },
  //   audio: {
  //     file: 'brady.mp3',
  //     author: 'Kevin MacLeod',
  //     title: 'A Very Brady Special',
  //   },
  //   duration: 60,
  // })

  await produce({
    duration: 10, // 60s
    video: { theme: 'stars' },
    audio: { genre: 'relaxing' },
  })
})
