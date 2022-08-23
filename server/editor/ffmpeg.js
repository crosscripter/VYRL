const { log } = require('../logger')
const { unlinkSync } = require('fs')
const { resolveFiles, tempName } = require('../utils')

const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
ffmpeg.setFfmpegPath(ffmpegPath)

const _ffmpeg = async (inputs, ext, ...options) => {
  return new Promise((resolve, reject) => {
    const out = tempName(ext)
    inputs = Array.isArray(inputs) ? inputs : [inputs]

    log(
      `ffmpeg ${inputs.map((i) => `-i ${i}`).join(' ')} ${options.join(
        ' '
      )} ${out}`
    )

    let $ffmpeg = ffmpeg()
    inputs.forEach((input) => {
      $ffmpeg = $ffmpeg.addInput(input)
    })

    $ffmpeg
      .outputOptions(...options)
      .output(out)
      .on('end', () => resolve(out))
      .on('error', (e) => reject(e))
      .run()
  })
}

const wavToMp3 = async (file) => {
  const out = await _ffmpeg(file, 'mp3', [])
  log(`ffmpeg: converted ${file} wav into mp3 ${out}`)
  return out
}

const createIntermediate = async (file) => {
  log('ffmpeg: transcoding', file, 'to MPEG-2 transport stream (H.264/AAC)...')
  return await _ffmpeg(
    file,
    'ts',
    '-c',
    'copy',
    '-bsf:v',
    'h264_mp4toannexb',
    '-f',
    'mpegts'
  )
}

const concatMedia = (ext, options) => async (files) => {
  const rfiles = resolveFiles(files)
  const names = await Promise.all(rfiles.map(createIntermediate))
  const namesString = names.join('|')
  log('ffmpeg: concatenating media ', namesString, '...')
  const out = await _ffmpeg(`concat:${namesString}`, ext, ...options)
  log(`ffmpeg: ${ext}s ${files.join(' ')} concatenated as ${out} successfully`)
  names.map((name) => unlinkSync(name))
  return out
}

const concatmp3 = concatMedia('mp3', ['-acodec', 'copy'])

const concatmp4 = concatMedia('mp4', ['-c', 'copy', '-bsf:a', 'aac_adtstoasc'])

const concatAV = async (files) => {
  const [video, audio] = files
  log(`ffmpeg: Adding audio ${audio} to video ${video}...`)
  const names = resolveFiles(files)
  const out = await _ffmpeg(
    names,
    'mp4',
    '-c',
    'copy',
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-shortest'
  )
  log(
    `ffmpeg: Audio track ${audio} added to ${video} video as ${out} successfully`
  )
  return out
}

module.exports = { concatmp3, concatmp4, concatAV, wavToMp3 }
