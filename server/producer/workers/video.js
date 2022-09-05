const { cpus } = require('os')
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

const MAX_PARALLEL = cpus().length

parentPort.on('message', async msg => {
  const log = progress.bind(this, 'video', 6)
  const { spec } = msg
  const { duration } = spec

  log(1, 'Searching for video assets')
  const { items: videos } = await getVideos(spec)

  log(2, 'Adding fade transitions to videos')
  const tasks = videos.map((v, i) => async () => {
    log(2.1, `parallel(${i + 1}/${MAX_PARALLEL}): Processing video ${v.file}`)
    const out = await fade(v)
    log(
      2.1,
      `parallel(${i + 1}/${MAX_PARALLEL}): Processed video ${v.file} --> ${out}`
    )
    return out
  })

  let video = await parallelLimit(tasks, MAX_PARALLEL)
  console.log('PARALLEL VIDOES', video)

  log(3, 'Concatenating video clips')
  video = await concatmp4(video)

  log(4, 'Looping video to duration')
  video = await loop(video, duration)

  log(5, 'Scaling video to full HD')
  video = await scale(video)

  log(6, 'Adding watermark to video')
  video = await watermark([video, WATERMARK])

  parentPort.postMessage({ video, videos })
})
