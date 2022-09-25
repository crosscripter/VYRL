const chalk = require('chalk')
const Producer = require('./producer')
const { package } = require('./packager')
const { progress } = require('../logger')
const { generateCaptions } = require('./captioner')
const { concatAV, subtitle } = require('../editor/ffmpeg')

const produce = async spec => {
  const log = progress.bind(this, 'producer', 7)
  console.time('produce')
  log(1, 'Producing video', spec)

  log(2, 'Loading audio/video assets')
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

  log(5, 'Mixing audio into video and encoding media')
  video = await concatAV([video, audio])

  log(6, 'Packaging for upload')
  const output = await package(spec, video, videos, captions, audios, audio)

  console.timeEnd('produce')
  log(7, 'Video produced', output)
  return output
}

module.exports = { produce }
