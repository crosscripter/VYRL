const { log } = require('../logger')
const { parse } = require('path')
const { unlinkSync } = require('fs')
const { resolveFiles, tempName } = require('../utils')

const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
ffmpeg.setFfmpegPath(ffmpegPath)

const _ffmpeg = async (inputs, ext, options = [], filter = null) => {
  return new Promise((resolve, reject) => {
    const out = tempName(ext)
    inputs = Array.isArray(inputs) ? inputs : [inputs]

    log(
      `\nffmpeg ${inputs.map((i) => `-i ${i}`).join(' ')} ${options.join(
        ' '
      )} ${filter ? `-filter_complex="${filter}"` : ''} ${out}\n`
    )

    let $ffmpeg = ffmpeg()
    inputs.forEach((input) => {
      $ffmpeg = $ffmpeg.addInput(input)
    })

    // $ffmpeg = $ffmpeg.addInputOption('-stream_loop', '0')
    $ffmpeg = $ffmpeg.outputOptions(...options).output(out)

    if (filter) $ffmpeg = $ffmpeg.complexFilter(filter)

    $ffmpeg
      .on('end', () => resolve(out))
      .on('error', (e) => reject(e))
      .run()
  })
}

const createIntermediate = async (file) => {
  log('ffmpeg: transcoding', file, 'to MPEG-2 transport stream (H.264/AAC)...')
  return await _ffmpeg(file, 'ts', [
    '-c',
    'copy',
    '-bsf:v',
    'h264_mp4toannexb',
    '-f',
    'mpegts',
  ])
}

const concatMedia = (ext, options) => async (files) => {
  const rfiles = resolveFiles(files)
  const names = await Promise.all(rfiles.map(createIntermediate))
  const namesString = names.join('|')
  log('ffmpeg: concatenating media ', namesString, '...')
  const out = await _ffmpeg(`concat:${namesString}`, ext, options)
  log(`ffmpeg: ${ext}s ${files.join(' ')} concatenated as ${out} successfully`)
  names.map((name) => unlinkSync(name))
  return out
}

const concatmp3 = concatMedia('mp3', ['-acodec', 'copy'])

const concatmp4 = concatMedia('mp4', ['-c', 'copy', '-bsf:a', 'aac_adtstoasc'])
// "[0:v]scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2[v0]; \
//  [v0][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]" \
// -map "[v]" -map "[a]" -c:v libx264 -c:a aac -movflags +faststart

const concatAV = async (files) => {
  const [video, audio] = files
  log(`ffmpeg: Adding audio ${audio} to video ${video}...`)
  const names = resolveFiles(files)
  const out = await _ffmpeg(names, 'mp4', [
    '-c',
    'copy',
    '-map',
    '0:v',
    '-map',
    '1:a',
  ])
  log(
    `ffmpeg: Audio track ${audio} added to ${video} video as ${out} successfully`
  )
  return out
}

const voiceOver = async (files) => {
  const names = resolveFiles(files)
  return await _ffmpeg(
    names,
    'mp3',
    ['-y'],
    '[0:0]volume=0.3[a];[1:0]volume=2.0[b];[a][b]amix=inputs=2:duration=longest'
  )
}

const fade = async ({ file, duration }) => {
  const [name] = resolveFiles([file])
  const ext = parse(name).ext.slice(1).trim()
  return await _ffmpeg(name, ext, [
    `-vf`,
    `fade=t=in:st=0:d=2,fade=t=out:st=${+duration - 2}:d=2`,
  ])
}

const subtitle = async (files) => {
  const names = resolveFiles(files)
  const [video, subtitle] = names
  return await _ffmpeg([video], 'mp4', ['-vf', `subtitles=${subtitle}`])
}

const watermark = async (files) => {
  const names = resolveFiles(files)
  const [video, watermark] = names

  return await _ffmpeg(
    [video, watermark],
    'mp4',
    ['-c:a', 'copy'],
    `[1][0]scale2ref=w=oh*mdar:h=ih*0.1[logo][video];` +
      `[video][logo]overlay=10:5:enable='gte(t,5)':format=auto,format=yuv420p;` +
      `[1]format=rgba,colorchannelmixer=aa=0.5[1]`
  )
}

const caption = async (inputs) => {
  const [video, videoTitle, videoCredits, songTitle, songCredits] = inputs
  const name = resolveFiles([video])
  log(
    `ffmpeg: Adding caption "${videoTitle}\n${videoCredits}\n\n${songTitle}\n${songCredits}" to video ${video}...`
  )

  const drawText = (text, x, y, size = 42, font = 'verdana', color = 'white') =>
    `drawtext=font=${font}:text='${text}':fontcolor=${color}:fontsize=${size}:x=${x}:y=h-th-${y}`

  const x = 20

  const filter = [
    drawText(`${videoTitle}`, x, 180),
    drawText(`${videoCredits}`, x, 160, 40),
    drawText(`${songTitle}`, x, 120, 42),
    drawText(`${songCredits}`, x, 100, 40),
  ].join(',')

  return await _ffmpeg(name, 'mp4', ['-codec:a', 'copy'], filter)
}

const reframe = async (video, fps) => {
  log(`ffmpeg: Adjusting frame rate to ${fps}...`)
  const name = resolveFiles([video])
  return await _ffmpeg(name, 'mp4', ['-filter:v', 'setpts=2.0*PTS'])
}

const loop = async (file, secs) => {
  const [input] = resolveFiles([file])
  const out = tempName(parse(file).ext.slice(1))
  log('input', input, out)

  return await new Promise((resolve, reject) => {
    ffmpeg()
      .addInput(input)
      .inputOptions('-stream_loop', '-1')
      .outputOptions('-c', 'copy', '-t', secs)
      .output(out)
      .on('end', () => resolve(out))
      .on('error', (e) => reject(e))
      .run()
  })
}

const wav2mp3 = async (wav) => {
  log(`ffmpeg: Converting ${wav} into mp3...`)
  const out = tempName('mp3')

  return await new Promise((resolve, reject) => {
    ffmpeg(wav)
      .addInput(wav)
      .output(out)
      .on('end', () => resolve(out))
      .on('error', (e) => reject(e))
      .run()
  })
}

module.exports = {
  concatmp3,
  concatmp4,
  concatAV,
  voiceOver,
  subtitle,
  watermark,
  wav2mp3,
  caption,
  loop,
  reframe,
  fade,
}
