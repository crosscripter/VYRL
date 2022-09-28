const { clean } = require('../utils')
const { progress } = require('../logger')
const { parallelLimit } = require('async')
const { loadAssets } = require('../loader')
const { getVideos } = require('../downloader')
const { parentPort } = require('worker_threads')

const {
  WATERMARK,
  SUBSCRIBE,
  RESOLUTIONS,
  DEFAULT_RESOLUTION,
} = require('../config')

const {
  scale,
  overlay,
  watermark,
  concatmp4,
  fade,
  loop,
} = require('../editor/ffmpeg')

parentPort.on('message', async msg => {
  let videos = []
  const log = progress.bind(this, 'video', 5)
  const { spec, PARALLEL_LIMIT } = msg

  if (spec.video.files) {
    log(1, 'Loading video assets')
    videos = await loadAssets(spec.video.files)
  } else {
    log(1, 'Searching for video assets')
    const res = await getVideos(spec)
    videos = res.items
  }

  log(2, 'Parallel processing videos')
  let video = await parallelLimit(
    videos.map((v, i) => async () => {
      let out = v.file
      const header = `parallel(${i + 1}/${videos.length}@${PARALLEL_LIMIT})`
      log(2.1, `${header}: Processing video ${out}`)

      if (spec.video.scale) {
        log(2.2, `${header}: Scaling video ${out} to ${spec.video.resolution}`)
        const [width, height] =
          RESOLUTIONS[spec.video?.resolution ?? DEFAULT_RESOLUTION]
        out = await scale(out, width, height)
      }

      if (spec.video.watermark) {
        log(2.3, `${header}: Watermarking video ${out}`)
        out = await watermark([out, WATERMARK])
      }

      if (spec.video.fade) {
        log(2.4, `${header}: Fading video ${out}`)
        out = await fade({ file: out, duration: v.duration })
      }

      log(2.5, `${header}: Processed video ${v.file} --> ${out}`)
      return out
    }),
    PARALLEL_LIMIT
  )

  log(3, 'Concatenating video clips')
  video = await concatmp4(video)

  log(4, 'Looping video to duration')
  video = await loop(video, spec.duration)

  if (spec.video.overlay) {
    log(5, 'Adding subscribe overlay')
    video = await overlay([video, SUBSCRIBE])
  }

  clean('temp.mp4', video)
  parentPort.postMessage({ video, videos })
})
