const { log } = require('../logger')
const { unlinkSync } = require('fs')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
ffmpeg.setFfmpegPath(ffmpegPath)

// ffmpeg -i input1.mp4 -c copy -bsf:v h264_mp4toannexb -f mpegts intermediate1.ts
const createIntermediate = async (file) => {
  log('ffmpeg: transcoding', file, 'to MPEG-2 transport stream (H.264/AAC)...')

  return new Promise((resolve, reject) => {
    const out = `./server/public/${Math.random().toString(13).slice(2)}.ts`

    ffmpeg(file)
      .outputOptions('-c', 'copy', '-bsf:v', 'h264_mp4toannexb', '-f', 'mpegts')
      .output(out)
      .on('end', () => resolve(out))
      .on('error', (e) => {
        log('transcoding error', e)
        reject(e)
      })
      .run()
  })
}

// ffmpeg -i "concat:intermediate1.ts|intermediate2.ts" -c copy -bsf:a aac_adtstoasc output.mp4
const concatVideos = async (files) => {
  const base = `./server/public`
  const names = await Promise.all(
    files.map((f) => createIntermediate(`${base}/${f}`))
  )
  const namesString = names.join('|')
  log('ffmpeg: concatenating', namesString, 'into single mp4...')

  await new Promise((resolve, reject) =>
    ffmpeg(`concat:${namesString}`)
      .outputOptions('-c', 'copy', '-bsf:a', 'aac_adtstoasc')
      .output(`${base}/output.mp4`)
      .on('end', resolve)
      .on('error', reject)
      .run()
  )

  names.forEach(unlinkSync)
  log(`ffmpeg: ${files.length} videos concatenated successfully`)
}

module.exports = { concatVideos }
