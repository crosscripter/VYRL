const { progress } = require('../../logger')
const { parentPort } = require('worker_threads')
const { getAudios } = require('../../downloader')
const { concatmp3 } = require('../../editor/ffmpeg')

parentPort.on('message', async msg => {
  const { spec } = msg
  const log = progress.bind(this, 'audio', 4)

  log(1, 'Searching for audio assets')
  const { items: audios } = await getAudios(spec)
  let audio = audios.map(({ file }) => file)

  log(3, 'Concatenating audio tracks')
  audio = await concatmp3(audio)

  parentPort.postMessage({ audio, audios })
})
