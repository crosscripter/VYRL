const { progress } = require('../../logger')
const { parentPort } = require('worker_threads')
const { getAudios } = require('../../downloader')
const { fade, loop, concatmp3 } = require('../../editor/ffmpeg')
const { INTRO_DURATION, OUTRO_DURATION } = require('../../config')
const { clean } = require('../../utils')

parentPort.on('message', async msg => {
  const { spec } = msg
  const log = progress.bind(this, 'audio', 5)
  const duration = INTRO_DURATION + spec.duration + OUTRO_DURATION

  log(1, 'Searching for audio assets')
  const { items: audios } = await getAudios(spec)
  let audio = audios.map(({ file }) => file)

  log(3, 'Concatenating audio tracks')
  audio = await concatmp3(audio)

  log(4, 'Looping audio to video duration')
  audio = await loop(audio, duration)

  if (spec.audio.fade) {
    log(5, 'Adding fade to audio')
    audio = await fade({ file: audio, duration })
  }

  clean('temp.mp3', audio)
  parentPort.postMessage({ audio, audios })
})
