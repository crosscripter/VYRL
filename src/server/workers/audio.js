const { clean } = require('../utils')
const log = require('../logger')('audio')
const { loadAssets } = require('../loader')
const { getAudios } = require('../downloader')
const { parentPort } = require('worker_threads')
const { fade, loop, concatmp3 } = require('../editor/ffmpeg')
const { INTRO_DURATION, OUTRO_DURATION } = require('../config').assets

parentPort.on('message', async msg => {
  let audios = []
  const { spec } = msg
  const duration = INTRO_DURATION + spec.duration + OUTRO_DURATION

  if (spec.audio.files) {
    log('assets', 'Loading audio assets')
    audios = await loadAssets(spec.audio.files)
  } else {
    log('assets', 'Searching for audio assets')
    const res = await getAudios(spec)
    audios = res.items
  }

  let audio = audios.map(({ file }) => file)

  log('concat', 'Concatenating audio tracks')
  audio = await concatmp3(audio)

  log('loop', 'Looping audio to video duration')
  audio = await loop(audio, duration)

  if (spec.audio.fade) {
    log('fade', 'Adding fade to audio')
    audio = await fade({ file: audio, duration })
  }

  clean('temp.mp3', audio)
  parentPort.postMessage({ audio, audios })
})
