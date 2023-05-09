const { clean } = require('../utils')
const log = require('../logger')('video')
const { parallelLimit } = require('async')
const { loadAssets } = require('../loader')
const { getVideos } = require('../downloader')
const { parentPort } = require('worker_threads')

const {
  assets: { WATERMARK, SUBSCRIBE },
  video: { RESOLUTIONS, DEFAULT_RESOLUTION },
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
  const { spec, PARALLEL_LIMIT } = msg

  if (spec.video.files) {
    log('assets', 'Loading video assets')
    videos = await loadAssets(spec.video.files)
  } else {
    log('assets', 'Searching for video assets')
    const res = await getVideos(spec)
    videos = res.items
  }

  log('process', 'Parallel processing videos')
  let video = await parallelLimit(
    videos.map((v, i) => async () => {
      let out = v.file
      const header = `(${i + 1}/${videos.length})x${PARALLEL_LIMIT}`
      log('process'+header, `Processing video ${out}`)

      if (spec.video.scale) {
        log('scale'+header, `Scaling video ${out} to ${spec.video.resolution}`)
        const [width, height] =
          RESOLUTIONS[spec.video?.resolution ?? DEFAULT_RESOLUTION]
        out = await scale(out, width, height)
      }

      if (spec.video.watermark) {
        log('watermark'+header, `Watermarking video ${out}`)
        out = await watermark([out, WATERMARK])
      }

      if (spec.video.fade && spec.video?.count !== 1) {
        log('fade'+header, `Fading video ${out}`)
        out = await fade({ file: out, duration: v.duration })
      }

      log('process'+header, `Processed video ${v.file} --> ${out}`)
      return out
    }),
    PARALLEL_LIMIT
  )

  log('concat', 'Concatenating video clips')
  video = await concatmp4(video)

  log('loop', 'Looping video to duration')
  video = await loop(video, spec.duration)

  if (spec.video.overlay) {
    log('overlay', 'Adding subscribe overlay')
    video = await overlay([video, SUBSCRIBE])
  }

  // clean('temp.mp4', video)
  parentPort.postMessage({ video, videos })
})
