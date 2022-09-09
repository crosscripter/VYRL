const { parallelLimit } = require('async')
const { progress } = require('../../logger')
const { parentPort } = require('worker_threads')
const { getAudios } = require('../../downloader')
const { concatmp3, loop, fade } = require('../../editor/ffmpeg')

parentPort.on('message', async msg => {
  const log = progress.bind(this, 'audio', 5)
  const { spec, PARALLEL_LIMIT } = msg
  const { duration } = spec

  log(1, 'Searching for audio assets')
  const { items: audios } = await getAudios(spec)

  let audio = audios.map(({ file }) => file)

  log(2, 'Adding fade to audio tracks')
  audio = await parallelLimit(
    audios.map((a, i) => async () => {
      let out = a.file
      const header = `parallel(${i + 1}/${audios.length}@${PARALLEL_LIMIT})`
      log(2.1, `${header}: Processing audio ${out}`)
      if (spec.audio.fade) out = await fade(a)
      log(2.1, `${header}: Processed audio ${a.file} --> ${out}`)
      return out
    }),
    PARALLEL_LIMIT
  )

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
