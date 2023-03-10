const { clean } = require('../utils')
const { progress } = require('../logger')
const { loadAssets } = require('../loader')
const { getAudios } = require('../downloader')
const { parentPort } = require('worker_threads')
const { fade, loop, concatmp3 } = require('../editor/ffmpeg')
const { INTRO_DURATION, OUTRO_DURATION } = require('../config').assets

parentPort.on('message', async msg => {
  let audios = []
  const { spec } = msg
  const log = progress.bind(this, 'audio', 5)
  const duration = INTRO_DURATION + spec.duration + OUTRO_DURATION

  if (spec.audio.files) {
    log(1, 'Loading audio assets')
    audios = await loadAssets(spec.audio.files)
  } else {
    log(1, 'Searching for audio assets')
    const res = await getAudios(spec)
    audios = res.items
  }

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
