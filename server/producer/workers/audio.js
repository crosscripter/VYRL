const { progress } = require('../../logger')
const { parentPort } = require('worker_threads')
const { getAudios } = require('../../producer')

const { concatmp3, loop, fade } = require('../../editor/ffmpeg')

parentPort.on('message', async msg => {
  const log = progress.bind(this, 'audio', 5)
  const { spec } = msg
  const { duration } = spec

  log(1, 'Searching for audio assets')
  const { items: audios } = await getAudios(spec)

  log(2, 'Adding fade to audio tracks')
  let audio = await Promise.all(audios.map(fade))

  log(3, 'Concatenating audio tracks')
  audio = await concatmp3(audio)

  log(4, 'Looping audio to duration')
  audio = await loop(audio, duration)

  log(5, 'Adding fade to audio')
  audio = await fade({ file: audio, duration })

  parentPort.postMessage({ audio, audios })
})
