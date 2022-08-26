const { log } = require('../logger')
const { say, transcribe } = require('../reader/reader')
const {
  concatAV,
  voiceOver,
  watermark,
  caption,
  subtitle,
  concatmp4,
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
  log(`produce: Producing video "${videoTitle}"...`)

  log(`produce: Watermarking video...`)
  video = await watermark([video, WATERMARK])

  log(`produce: Generating voice over...`)
  const speech = await say(transcript)
  let audio = await voiceOver([song, speech])

  log(`produce: Mixing audio...`)
  video = await concatAV([video, audio])

  log(`produce: Adding captions...`)
  video = await caption([
    video,
    videoTitle,
    videoCredits,
    songTitle,
    songCredits,
  ])

  log(`produce: Adding subtitles...`)
  const subtitles = await transcribe(transcript)
  video = await subtitle([video, subtitles])

  log(`produce: Adding intro and outro...`)
  video = await concatmp4([INTRO, video, OUTRO])

  log(`produce: Video produced at ${video}`)
  return video
}

module.exports = { produce }
