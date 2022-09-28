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
