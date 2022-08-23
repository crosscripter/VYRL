const { log } = require('../logger')
const { unlinkSync } = require('fs')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
ffmpeg.setFfmpegPath(ffmpegPath)

const base = `./server/public`

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

const resolveFiles = async (files) => {
  const names = await Promise.all(
    files.map((f) => createIntermediate(`${base}/${f}`))
  )

  log('ffmpeg: resolved media paths', names)
  return names
}

const ffmpegCli = async (inputs, output, ...options) => {
  return await new Promise((resolve, reject) => {
    const input = Array.isArray(inputs)
      ? inputs.reduce(
          (result, inputItem) => result.addInput(inputItem),
          ffmpeg()
        )
      : ffmpeg(inputs)

    input
      .outputOptions(...options)
      .output(`${base}/${output}`)
      .on('end', resolve)
      .on('error', reject)
      .run()
  })
}

const concatMedia = (ext, options) => async (files) => {
  const names = await resolveFiles(files)
  const namesString = names.join('|')
  log('ffmpeg: concatenating media ', namesString, '...')
  await ffmpegCli(`concat:${namesString}`, `output.${ext}`, ...options)
  names.forEach(unlinkSync)
  log(`ffmpeg: ${files.length} ${ext}s concatenated successfully`)
}

// ffmpeg -i "concat:20181021_080743.MP3|20181021_090745.MP3|20181021_100745.MP3" -acodec copy 20181021.mp3
const concatmp3 = concatMedia('mp3', ['-acodec', 'copy'])

// ffmpeg -i "concat:intermediate1.ts|intermediate2.ts" -c copy -bsf:a aac_adtstoasc output.mp4
const concatmp4 = concatMedia('mp4', ['-c', 'copy', '-bsf:a', 'aac_adtstoasc'])

// ffmpeg -i input.mp4 -i input.mp3 -c copy -map 0:v:0 -map 1:a:0 output.mp4
const concatAV = async (files) => {
  const [video, audio] = files
  log(`ffmpeg: Adding audio ${audio} to video ${video}...`)
  const names = await resolveFiles(files)
  log('ffmpeg: editing media ', names, '...')
  await ffmpegCli(
    names,
    `output.mp4`,
    '-c',
    'copy',
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-shortest'
  )
  names.forEach(unlinkSync)
  log(`ffmpeg: Audio track ${audio} added to ${video} video successfully!`)
}

module.exports = { concatmp3, concatmp4, concatAV }
