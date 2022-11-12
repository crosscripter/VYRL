const { stringify } = JSON
const chalk = require('chalk')
const { join } = require('path')
const { log } = require('../logger')
const { clean } = require('../utils')
const { package } = require('../packager')
const { progress } = require('../logger')
const { Worker } = require('worker_threads')
const { INTRO, OUTRO } = require('../config')
const PARALLEL_LIMIT = require('os').cpus().length
const { generateCaptions } = require('../captioner')
const { concatAV, concatmp4, subtitle } = require('../editor/ffmpeg')

const Producer = (type, spec) => {
  return new Promise(async resolve => {
    console.time(type)
    log(1, `Spawing new ${type} producer`)
    const worker = new Worker(`./src/server/workers/${type}.js`)
    worker.postMessage({ spec, PARALLEL_LIMIT })

    worker.on('message', async msg => {
      console.timeEnd(type)
      log(2.1, `${type} producer sent result`, msg)
      return resolve(msg)
    })
  })
}

const produce = async spec => {
  const log = progress.bind(this, 'producer', 8)
  console.time('produce')
  log(1, 'Producing video', spec)

  log(2, 'Fetching audio/video assets')
  let [{ audio, audios }, { video, videos }] = await Promise.all(
    ['audio', 'video'].map(type => Producer(type, spec))
  )

  let captions = { lines: [] }

  if (spec.captions) {
    log(3, 'Generating video/audio captions')
    captions = await generateCaptions(videos, audios)

    log(4, 'Burning in subtitles')
    video = await subtitle([video, captions.file])
  }

  log(5, 'Concatenating intro and outro to video')
  video = await concatmp4([INTRO, video, OUTRO])

  log(6, 'Mixing audio into video and encoding media')
  video = await concatAV([video, audio])

  log(7, 'Packaging for upload')
  const output = await package(spec, video, videos, captions, audios, audio)

  console.timeEnd('produce')
  log(8, 'Video produced', output)
  return output
}

module.exports = { produce }

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

  log('Generating voiceover...')
  const narrations = await Promise.all(
    analysis.map(({ sentence }) => say(sentence))
  )
  const narration = await concatmp3(narrations)
  console.log('narration', narrations, narration, 'audio', audio)
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

  log(`videos found for "${phrase}"\n\n`, results)

  const resultVideos = await Promise.all(
    results.map(async result => {
      let { sentence, video } = result
      log(`Creating video for "${sentence}" from "${video.name}"...`)

      const text = sentence
        .replace(/([^’'\(\)\s\w])/g, `$1\n`)
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

  log('Scaling video to FULL HD')
  const { RESOLUTIONS } = require('./config')
  video = await scale(video, ...RESOLUTIONS.HD)

  log(`Mixing audio and video...`)
  video = await concatAV([video, audio])

  log(`Final video created for "${phrase}"\n`, video)

}