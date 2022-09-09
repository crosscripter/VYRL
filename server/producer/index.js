const chalk = require('chalk')
const { join } = require('path')
const { renameSync } = require('fs')
const { clean } = require('../utils')
const { progress } = require('../logger')
const { Worker } = require('worker_threads')
const { INTRO, OUTRO } = require('../config')
const { generateCaptions, generateDescription } = require('./captioner')
const { default: getVideoDurationInSeconds } = require('get-video-duration')

const {
  fade,
  concatAV,
  subtitle,
  thumbnail,
  concatmp4,
  loop,
} = require('../editor/ffmpeg')

const log = progress.bind(this, 'producer', 13)
const PARALLEL_LIMIT = require('os').cpus().length

const produce = async spec => {
  console.time('produce')
  log(1, 'Producing video', spec)

  const Producer = (type, spec) => {
    return new Promise(resolve => {
      console.time(type)
      const worker = new Worker(join(__dirname, 'workers', `${type}.js`))
      worker.postMessage({ spec, PARALLEL_LIMIT })

      worker.on('message', async msg => {
        console.timeEnd(type)
        log(2.1, `${type} producer sent result`, msg)
        return resolve(msg)
      })
    })
  }

  log(2, 'Spawing audio/video parallel processing...')
  const producers = [Producer('video', spec), Producer('audio', spec)]
  let [{ video, videos }, { audio, audios }] = await Promise.all(producers)

  let captions = { lines: [] }

  if (spec.captions) {
    log(3, 'Generating video/audio captions')
    captions = await generateCaptions(videos, audios)

    log(4, 'Burning in subtitles')
    video = await subtitle([video, captions.file])
  }

  log(5, 'Concatenating intro and outro to video')
  video = await concatmp4([INTRO, video, OUTRO])

  log(6, 'Calculating total video duration')
  const duration = await getVideoDurationInSeconds(video)
  console.log('duration', duration)

  log(7, 'Looping audio to video duration')
  audio = await loop(audio, duration)

  if (spec.audio.fade) {
    log(8, 'Adding fade to audio')
    audio = await fade({ file: audio, duration })
  }

  log(9, 'Mixing audio into video and encoding media')
  video = await concatAV([video, audio])
  const result = video.replace(/temp/g, 'out')
  renameSync(video, result)

  log(10, 'Generating description')
  const description = await generateDescription(spec, captions)

  log(11, 'Generating thumbnail')
  let thumb = await thumbnail(result, `${spec.audio.theme} ${spec.video.theme}`)
  const thumbResult = thumb.replace(/temp/g, 'out')
  renameSync(thumb, thumbResult)

  log(12, 'Cleaning up temp files')
  clean()

  console.timeEnd('produce')
  const product = { thumb: thumbResult, video: result, description }
  log(13, chalk`Video produced successfully!\n\n{bold {green ${result}}}\n`, {
    spec,
    video: result,
    videoCount: videos.length,
    audio,
    audioCount: audios.length,
    output: product,
  })

  return product
}

module.exports = { produce }
