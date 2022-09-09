const { parallelLimit } = require('async')
const { progress } = require('../../logger')
const { parentPort } = require('worker_threads')
const { getVideos } = require('../../downloader')
const { concatmp4, fade } = require('../../editor/ffmpeg')

parentPort.on('message', async msg => {
  const log = progress.bind(this, 'video', 5)
  const { spec, PARALLEL_LIMIT } = msg

  log(1, 'Searching for video assets')
  const { items: videos } = await getVideos(spec)

  log(2, 'Parallel processing videos')
  let video = await parallelLimit(
    videos.map((v, i) => async () => {
      let out = v.file
      const header = `parallel(${i + 1}/${videos.length}@${PARALLEL_LIMIT})`
      log(2.1, `${header}: Processing video ${out}`)
      if (spec.video.fade && (i === 0 || i === videos.length - 1))
        out = await fade(v)
      log(2.1, `${header}: Processed video ${v.file} --> ${out}`)
      return out
    }),
    PARALLEL_LIMIT
  )

  log(3, 'Concatenating video clips')
  video = await concatmp4(video)

  parentPort.postMessage({ video, videos })
})
