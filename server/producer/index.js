const chalk = require('chalk')
const { join } = require('path')
const { renameSync } = require('fs')
const { clean } = require('../utils')
const { progress } = require('../logger')
const { Worker } = require('worker_threads')
const { INTRO, OUTRO } = require('../config')
const { generateCaptions, generateDescription } = require('./captioner')
const { concatAV, subtitle, thumbnail, concatmp4 } = require('../editor/ffmpeg')

const log = progress.bind(this, 'producer', 11)
const PARALLEL_LIMIT = require('os').cpus().length

const produce = async spec => {
  console.time('produce')
  log(1, 'Producing video', spec)

  const { duration } = spec
  const [introDuration, outroDuration] = [5, 7]
  spec.duration = duration + introDuration + outroDuration

  log(2, 'Calculating media durations', {
    duration,
    introDuration,
    outroDuration,
    totalDuration: spec.duration,
  })

  log(3, 'Spawing audio/video parallel processing...')

  const Producer = (type, spec) =>
    new Promise(resolve => {
      console.time(type)
      const worker = new Worker(join(__dirname, 'workers', `${type}.js`))
      worker.postMessage({ spec, PARALLEL_LIMIT })
      worker.on('message', async msg => {
        console.timeEnd(type)
        console.log(
          chalk`{bold {blue ${type}}}: Result from ${type} producer`,
          msg
        )
        return resolve(msg)
      })
    })

  const producers = [Producer('video', spec), Producer('audio', spec)]
  let [{ video, videos }, { audio, audios }] = await Promise.all(producers)

  let captions = { lines: [] }

  if (spec.captions) {
    log(4, 'Generating video/audio captions')
    captions = await generateCaptions(videos, audios)

    log(5, 'Burning in subtitles')
    video = await subtitle([video, captions.file])
  }

  log(6, 'Concatenating intro and outro to video')
  video = await concatmp4([INTRO, video, OUTRO])

  log(7, 'Mixing audio into video and encoding media')
  video = await concatAV([video, audio])

  log(8, 'Cleaning up temp files')
  const result = video.replace(/temp/g, 'out')
  renameSync(video, result)
  clean()

  log(10, 'Generating description')
  const description = await generateDescription(spec, captions)

  log(11, 'Generating thumbnail')
  const thumb = await thumbnail(
    result,
    `${spec.audio.theme} ${spec.video.theme}`
  )

  console.timeEnd('produce')

  const product = { thumb, video: result, description }
  log(11, chalk`Video produced successfully!\n\n{bold {green ${result}}}\n`, {
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
