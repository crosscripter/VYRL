const { cpus } = require('os')
const { parallelLimit } = require('async')
const { progress } = require('../../logger')
const { parentPort } = require('worker_threads')
const { getAudios } = require('../../producer')
const { concatmp3, loop, fade } = require('../../editor/ffmpeg')

const MAX_PARALLEL = cpus().length

parentPort.on('message', async msg => {
  const log = progress.bind(this, 'audio', 5)
  const { spec } = msg
  const { duration } = spec

  log(1, 'Searching for audio assets')
  const { items: audios } = await getAudios(spec)

  let audio = audios.map(({ file }) => file)

  if (spec.audio.fade) {
    log(2, 'Adding fade to audio tracks')

    const tasks = audios.map((a, i) => async () => {
      log(
        2.1,
        `parallel(${i + 1}/${
          audios.length
        }@${MAX_PARALLEL}): Processing audio ${a.file}`
      )
      const out = await fade(a)
      log(
        2.1,
        `parallel(${i + 1}/${audios.length}@${MAX_PARALLEL}): Processed audio ${
          a.file
        } --> ${out}`
      )
      return out
    })

    audio = await parallelLimit(tasks, MAX_PARALLEL)
    console.log('PARALLEL AUDIOS', audio)
  }

  log(3, 'Concatenating audio tracks')
  audio = await concatmp3(audio)

  log(4, 'Looping audio to duration')
  audio = await loop(audio, duration)

  if (spec.audio.fade) {
    log(5, 'Adding fade to audio')
    audio = await fade({ file: audio, duration })
  }

  parentPort.postMessage({ audio, audios })
})
