const express = require('express')
const { log } = require('./logger')
const { SERVER_HOST, SERVER_PORT } = require('./config')

const SERVER_URL = `${SERVER_HOST}:${SERVER_PORT}`

app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(express.static('./server/public'))
app.get('/', (_, res) => res.send(`<h1><tt>VYRL Server</tt></h1>`))

app.listen(SERVER_PORT, async () => {
  console.clear()
  log(`Server launched at ${SERVER_URL} 🚀`)

  // const { produce } = require('./producer')
  // const spec = require('./specs/rain.spec')
  // return await produce(spec)

  const { analyze } = require('./analyzer')
  const { getVideos, getAudios } = require('./downloader')
  const {
    fadeText,
    fade,
    concatAV,
    concatmp3,
    concatmp4,
  } = require('./editor/ffmpeg')

  const phrase = `
  The Lord is my shepherd;
I shall not want.
He makes me to lie down in green pastures;
He leads me beside the still waters.
He restores my soul;
He leads me in the paths of righteousness
For His name’s sake.
`.trim()

  const analysis = analyze(phrase)

  const sentiment = analysis.reduce(
    (score, { sentiment }) => score + sentiment,
    0
  )

  const duration = analysis.length * ((2 + 3 + 5 + 8 + 4 + 2) * 2)
  const audioTheme = sentiment > 0.5 ? 'happy' : 'dramatic'
  log('sentiment score is', sentiment, 'theme is', audioTheme)

  log(`Creating audio for "${audioTheme}"...`)
  const { items: audios } = await getAudios({
    duration,
    audio: {
      theme: audioTheme,
    },
  })

  if (!audios.length) throw 'No audio found for ' + audioTheme
  let audio = await concatmp3(audios.map(({ file }) => file))
  audio = await fade({ file: audio, duration })

  const results = await Promise.all(
    analysis.map(async ({ sentence, nouns }) => {
      const theme = nouns.sort().shift()
      const { items: videos } = await getVideos({
        duration,
        video: { count: 1, theme },
      })
      const [video] = videos
      return { sentence, video }
    })
  )

  log(`videos found for "${phrase}"\n\n`, results)

  const resultVideos = await Promise.all(
    results.map(async result => {
      let { sentence, video } = result
      log(`Creating video for "${sentence}" from "${video.name}"...`)

      const text = sentence
        .replace(/([^\s\w])/g, `$1\n`)
        .split('\n')
        .map(x => x.trim())
        .join('\n')

      console.log('text', text)
      log(`Adding fade transitions...`)
      video = await fade({ file: video.file, duration: video.duration })
      video = await fadeText(video, text)
      log(`video created for "${sentence}"`, video)
      return video
    })
  )

  log(`Concatenating all videos...`)
  video = await concatmp4(resultVideos)

  log(`Mixing audio and video...`)
  video = await concatAV([video, audio])

  log(`Final video created for "${phrase}"\n`, video)
  log('done')
})
