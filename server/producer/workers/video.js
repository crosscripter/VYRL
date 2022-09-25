const { parallelLimit } = require('async')
const { progress } = require('../../logger')
const { parentPort } = require('worker_threads')
const { getVideos } = require('../../downloader')
const { INTRO, OUTRO, WATERMARK, SUBSCRIBE } = require('../../config')
const { clean } = require('../../utils')

const {
  scale,
  overlay,
  watermark,
  concatmp4,
  fade,
  loop,
} = require('../../editor/ffmpeg')

parentPort.on('message', async msg => {
  const log = progress.bind(this, 'video', 8)
  const { spec, PARALLEL_LIMIT } = msg

  log(1, 'Searching for video assets')
  let { items: videos } = await getVideos(spec)

  log(2, 'Parallel processing videos')
  let video = await parallelLimit(
    videos.map((v, i) => async () => {
      let out = v.file
      const header = `parallel(${i + 1}/${videos.length}@${PARALLEL_LIMIT})`
      log(2.1, `${header}: Processing video ${out}`)
      if (spec.video.scale) out = await scale(out)
      if (spec.video.watermark) out = await watermark([out, WATERMARK])
      if (spec.video.fade) out = await fade({ file: out, duration: v.duration })
      log(2.1, `${header}: Processed video ${v.file} --> ${out}`)
      return out
    }),
    PARALLEL_LIMIT
  )

  log(3, 'Concatenating video clips')
  video = await concatmp4(video)

  log(4, 'Looping video to duration')
  video = await loop(video, spec.duration)

  log(7, 'Adding subscribe overlay')
  if (spec.video.overlay) video = await overlay([video, SUBSCRIBE])

  console.log('video=', video)
  log(8, 'Concatenating intro and outro to video')
  video = await concatmp4([INTRO, video, OUTRO])

  clean('temp.mp4', video)
  parentPort.postMessage({ video, videos })
})
