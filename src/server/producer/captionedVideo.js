const log = require('../logger')('producer')

const produceCaptionedVideo = async () => {
  const { analyze } = require('./analyzer')
  const { getVideos, getAudios } = require('./downloader')
  const {
    fadeText,
    fade,
    concatAV,
    concatmp3,
    concatmp4,
    scale,
    voiceOver,
  } = require('./editor/ffmpeg')

  const phrase = `
Caving – also known as spelunking in the United States and Canada
and potholing in the United Kingdom and Ireland
is the recreational pastime of exploring wild cave systems
(as distinguished from show caves).
In contrast, speleology is the scientific study of caves
and the cave environment.
`.trim()

  const analysis = analyze(phrase)

  const sentiment = analysis.reduce(
    (score, { sentiment }) => score + sentiment,
    0
  )

  const duration = analysis.length * ((2 + 3 + 5 + 8 + 4 + 2) * 2)
  const audioTheme = sentiment > 0.5 ? 'happy' : 'dramatic'
  log('sentiment', 'sentiment score is', sentiment, 'theme is', audioTheme)

  log('audio', `Creating audio for "${audioTheme}"...`)
  const { items: audios } = await getAudios({
    duration,
    audio: {
      theme: audioTheme,
    },
  })

  if (!audios.length) throw 'No audio found for ' + audioTheme
  let audio = await concatmp3(audios.map(({ file }) => file))
  audio = await fade({ file: audio, duration })

  log('voiceover', 'Generating voiceover...')
  const narrations = await Promise.all(
    analysis.map(({ sentence }) => say(sentence))
  )
  const narration = await concatmp3(narrations)
  log('narration', 'narration', narrations, narration, 'audio', audio)
  audio = await voiceOver([audio, narration])

  const results = await Promise.all(
    analysis.map(async ({ sentence, keywords, nouns }) => {
      let theme = nouns.join(' ').trim()
      theme = `nature ${theme}`
      const { items: videos } = await getVideos({
        duration,
        video: { count: 1, theme },
      })
      let [video] = videos
      return { sentence, video }
    })
  )

  log('search', `videos found for "${phrase}"\n\n`, results)

  const resultVideos = await Promise.all(
    results.map(async result => {
      let { sentence, video } = result
      log('create', `Creating video for "${sentence}" from "${video.name}"...`)

      const text = sentence
        .replace(/([^’'\(\)\s\w])/g, `$1\n`)
        .split('\n')
        .map(x => x.trim())
        .join('\n')

      log('fade', `Adding fade transitions...`)
      video = await fade({ file: video.file, duration: video.duration })
      video = await fadeText(video, text)
      log('create', `video created for "${sentence}"`, video)
      return video
    })
  )

  log('concat', `Concatenating all videos...`)
  video = await concatmp4(resultVideos)

  log('scale', 'Scaling video to FULL HD')
  const { RESOLUTIONS } = require('./config').video
  video = await scale(video, ...RESOLUTIONS.HD)

  log('mixer', `Mixing audio and video...`)
  video = await concatAV([video, audio])

  log('captionedVideo', `Final video created for "${phrase}"\n`, video)
}