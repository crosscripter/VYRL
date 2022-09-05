const { parallelLimit } = require('async')
const { progress } = require('../../logger')
const { parentPort } = require('worker_threads')
const { getVideos, WATERMARK, INTRO, OUTRO } = require('../../producer')
const {
  watermark,
  concatmp4,
  loop,
  fade,
  scale,
} = require('../../editor/ffmpeg')
const MAX_PARALLEL = 10

parentPort.on('message', async msg => {
  const log = progress.bind(this, 'video', 6)
  const { spec } = msg
  const { duration } = spec

  log(1, 'Searching for video assets')
  const { items: videos } = await getVideos(spec)

  log(2, 'Adding fade transitions to videos')
  parallelLimit(
    videos.map(function (v) {
      return async function () {
        log(`parallel: Processing video ${v.file}...`)
        const out = await fade(v)
        log(`parallel: Processed video ${v.file}`, out)
        return out
      }
    }),
    MAX_PARALLEL,
    async (err, video) => {
      if (err) log('ERROR PARALLEL PROCESSING VIDEOS', err, err.message)
      log(3, 'Concatenating video clips')
      video = await concatmp4(video)

      log(4, 'Looping video to duration')
      video = await loop(video, duration)

      log(5, 'Scaling video to full HD')
      video = await scale(video)

      log(6, 'Adding watermark to video')
      video = await watermark([video, WATERMARK])

      parentPort.postMessage({ video, videos })
    }
  )
})
