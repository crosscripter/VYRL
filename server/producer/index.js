const chalk = require('chalk')
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
  log(chalk`produce: {yellow {bold WAIT}} Producing video "${videoTitle}"...`)

  log(chalk`produce: {yellow {bold WAIT}} Watermarking video...`)
  video = await watermark([video, WATERMARK])

  log(chalk`produce: {yellow {bold WAIT}} Adding captions...`)
  video = await caption([
    video,
    videoTitle,
    videoCredits,
    songTitle,
    songCredits,
  ])

  log(`produce: {yellow {bold WAIT}} Adding intro and outro...`)
  video = await concatmp4([INTRO, video, OUTRO])

  log(chalk`produce: {yellow {bold WAIT}} Generating voice over...`)
  const speech = await say(transcript)
  let audio = await voiceOver([song, speech])

  log(chalk`produce: {yellow {bold WAIT}} Mixing audio...`)
  video = await concatAV([video, audio])

  log(chalk`produce: {yellow {bold WAIT}} Adding subtitles...`)
  const subtitles = await transcribe(transcript)
  video = await subtitle([video, subtitles])

  log(chalk`{green {bold DONE}} video ${videoTitle} produced at ${video}`)
  return video
}

module.exports = { produce }
