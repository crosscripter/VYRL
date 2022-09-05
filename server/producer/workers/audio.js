const { parallelLimit } = require('async')
const { progress } = require('../../logger')
const { parentPort } = require('worker_threads')
const { getAudios } = require('../../producer')

const { concatmp3, loop, fade } = require('../../editor/ffmpeg')
const MAX_PARALLEL = 10

parentPort.on('message', async msg => {
  const log = progress.bind(this, 'audio', 5)
  const { spec } = msg
  const { duration } = spec

  log(1, 'Searching for audio assets')
  const { items: audios } = await getAudios(spec)

  log(2, 'Adding fade to audio tracks')
  parallelLimit(
    audios.map(function (a, i) {
      return async function () {
        log(`2.${i + 1}`, `parallel: Processing audio`, a.file)
        const out = await fade(a)
        log(`2.${i + 1}`, `parallel: Processed audio`, { file: a.file, out })
        return out
      }
    }),
    MAX_PARALLEL,
    async (err, audio) => {
      if (err) log('ERROR PARALLEL PROCESSING AUDIO', err, err.message)
      console.log('audio', audio)

      log(3, 'Concatenating audio tracks')
      audio = await concatmp3(audio)

      log(4, 'Looping audio to duration')
      audio = await loop(audio, duration)

      log(5, 'Adding fade to audio')
      audio = await fade({ file: audio, duration })

      parentPort.postMessage({ audio, audios })
    }
  )
})
