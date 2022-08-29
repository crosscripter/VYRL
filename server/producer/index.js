const chalk = require('chalk')
const _ = require('underscore')
const pexels = require('../downloader/pexels')
const pixabay = require('../downloader/pixabay')

const { log } = require('../logger')
const { say, transcribe } = require('../reader/reader')
const {
  concatAV,
  voiceOver,
  watermark,
  caption,
  subtitle,
  concatmp3,
  concatmp4,
  reframe,
  loop,
} = require('../editor/ffmpeg')

const INTRO = 'intro2.mp4'
const OUTRO = 'outro4.mp4'
const WATERMARK = 'watermark.gif'

const produce = async ({
  video,
  videoTitle,
  videoCredits,
  song,
  songTitle,
  songCredits,
  transcript,
}) => {
  log(chalk`produce: {yellow {bold WAIT}} Producing video "${videoTitle}"...`)

  log(chalk`produce: {yellow {bold WAIT}} Watermarking video...`)
  video = await watermark([video, WATERMARK])

  if (videoTitle || videoCredits || songTitle || songCredits) {
    log(chalk`produce: {yellow {bold WAIT}} Adding captions...`)
    video = await caption([
      video,
      videoTitle,
      videoCredits,
      songTitle,
      songCredits,
    ])
  }

  log(`produce: {yellow {bold WAIT}} Adding intro and outro...`)
  video = await concatmp4([INTRO, video, OUTRO])

  let audio
  if (transcript) {
    log(chalk`produce: {yellow {bold WAIT}} Generating voice over...`)
    const speech = await say(transcript)
    audio = await voiceOver([song, speech])
  } else {
    audio = song
  }

  log(chalk`produce: {yellow {bold WAIT}} Mixing audio...`)
  video = await concatAV([video, audio])

  if (transcript) {
    log(chalk`produce: {yellow {bold WAIT}} Adding subtitles...`)
    const subtitles = await transcribe(transcript)
    video = await subtitle([video, subtitles])
  }

  log(chalk`{green {bold DONE}} video ${videoTitle} produced at ${video}`)
  return video
}

const generate = async (visuals, genre) => {
  log(
    chalk`generate: {yellow {bold WAIT}} Generating "${visuals}" video with "${genre}" music...`
  )

  //Audio
  log(
    chalk`generate: {yellow {bold WAIT}} Searching Pixabay for "${genre}" tracks...`
  )
  const raudio = _.sample(await pixabay.search(genre))
  const { name: songTitle, href } = raudio
  const songCredits = '@Anonymous at Pixabay'

  log(
    chalk`generate: {yellow {bold WAIT}} Found audio "${songTitle}" by "${songCredits}" at\n${href}`
  )
  const song = await pexels.download(raudio.href)
  log(
    chalk`generate: {yellow {bold WAIT}} Downloaded audio "${songTitle}" by "${songCredits}" from ${href} to ${song}`
  )

  // Video
  log(
    chalk`generate: {yellow {bold WAIT}} Searching Pexels for "${visuals}" videos..`
  )
  const rvideos = _.sample(await pexels.search(visuals, 10), 3)

  const cvideos = await Promise.all(
    rvideos.map(async (rvideo, i) => {
      log('rvideo', i, JSON.stringify(rvideo))
      const { name: videoTitle, url, video } = rvideo
      const videoCredits = rvideo.name

      log(
        chalk`generate: {yellow {bold WAIT}} Found video "${videoTitle}" by "${videoCredits}" at\n${video}`
      )
      let videoFile = await pexels.download(rvideo.video)
      log(
        chalk`generate: {yellow {bold WAIT}} Downloaded video "${videoTitle}" by "${videoCredits}" from ${video} to ${videoFile} `
      )

      videoFile = await caption([
        videoFile,
        videoTitle,
        videoCredits,
        songTitle,
        songCredits,
      ])

      videoFile = await loop(video, 120)
      return videoFile
    })
  )

  log('cvideos=', JSON.stringify(cvideos))
  const videoFile = await concatmp4(cvideos)

  return await produce({
    video: videoFile,
    videoTitle: '',
    videoCredits: '',
    song,
    songTitle: '',
    songCredits: '',
    transcript: '',
  })
}

const getItems =
  (type, service, prop, concat) => async (query, count, duration) => {
    log(chalk`Finding ${count} ${query} ${type}s of ${duration}s....`)
    const items = _.sample(await service.search(query, count), count)
    if (!items.length) throw `No ${type} found for ` + query
    log(chalk`Found ${items.length} item(s): ${JSON.stringify(items)}`)

    const files = await Promise.all(
      items.map(async (item) => {
        log(chalk`Downloading ${item[prop]}...`)
        let file = await pexels.download(item[prop])
        log(chalk`Downloaded ${item[prop]} to ${file}...`)
        file = await loop(file, duration)
        return file
      })
    )

    const [first, ...rest] = files
    const result = await concat([first, ...rest])
    log(chalk`${type} result: ${result}`)
    return result
  }

const getVideos = getItems('video', pexels, 'video', concatmp4)

const getAudios = getItems('audio', pixabay, 'href', concatmp3)

const rainVideo = async (duration) => {
  log(chalk`Generating rain video of ${duration}s...`)
  let video = await getVideos('rain', 50, 60)
  log('\n\nvideo', video)
  let audio = await getAudios('chill', 20, 60)
  log('\n\naudio', audio)
  return await concatAV([video, audio])
}

module.exports = { produce, generate, rainVideo }
