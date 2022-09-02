const chalk = require('chalk')
const { cpus } = require('os')
const { log } = require('../logger')
const { unlinkSync } = require('fs')
const { resolveFiles, fileExt, tempName } = require('../utils')

const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
ffmpeg.setFfmpegPath(ffmpegPath)

const options = {
  CAPTION: '-codec:a copy',
  CONCATMP3: '-acodec copy',
  LOOP_INPUT: `-stream_loop -1`,
  CONCATMP4: '-c copy -bsf:a aac_adtstoasc',
  LOOP_OUTPUT: secs => `-c copy -t ${secs}`,
  FADE: (type, filter) => `-${type}f ${filter}`,
  CONCAT_AUDIO_VIDEO: '-c copy -map 0:v -map 1:a',
  REFRAME: scale => `-filter:v setpts=${scale}*PTS`,
  TRANSCODE: '-c copy -bsf:v h264_mp4toannexb -f mpegts',
  SUBTITLE: file => `-vf subtitles=${file}:force_style='Shadow=0,MarginV=10'`,
  SCALE: `-vf scale=w=1920:h=1080:force_original_aspect_ratio=1:out_color_matrix=bt709:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:#001326`,
}

const filters = {
  FADE: duration => `fade=t=in:st=0:d=2,fade=t=out:st=${+duration - 2}:d=2`,
  VOICEOVER:
    '[0:0]volume=0.3[a];[1:0]volume=2.0[b];[a][b]amix=inputs=2:duration=longest',
  DRAWTEXT: ([text, y, size = 42]) =>
    `drawtext=font=verdana:text='${text}':fontcolor=white:fontsize=${size}:x=20:y=h-th-${y}`,
  WATERMARK:
    `[1][0]scale2ref=w=oh*mdar:h=ih*0.08[logo][video];` +
    `[video][logo]overlay=10:10:enable='gte(t,3)':format=auto,format=yuv420p;` +
    `[1]format=rgba,colorchannelmixer=aa=0.25[1]`,
}

const _ffmpeg = (inputs, ext, outputOptions, filter, inputOptions) => {
  return new Promise((resolve, reject) => {
    inputOptions = inputOptions?.split(' ') ?? []
    outputOptions = outputOptions?.split(' ') ?? []

    if (!inputOptions.length) inputOptions.push(`-threads ${cpus().length / 2}`)
    const out = tempName(ext)

    inputs = Array.isArray(inputs) ? inputs : [inputs]

    if (!inputs.find(i => i.includes(':'))) inputs = resolveFiles(inputs)

    log(
      chalk.yellow(
        'ffmpeg',
        ...inputOptions,
        ...inputs.map(i => `-i ${i}`),
        ...outputOptions,
        filter ? `-filter_complex="${filter}"` : '',
        out
      )
    )

    let $ffmpeg = ffmpeg()
    inputs.forEach(input => ($ffmpeg = $ffmpeg.addInput(input)))
    if (inputOptions.length) $ffmpeg = $ffmpeg.inputOptions(...inputOptions)

    if (outputOptions.length) $ffmpeg = $ffmpeg.outputOptions(...outputOptions)
    $ffmpeg = $ffmpeg.output(out)

    if (filter) $ffmpeg = $ffmpeg.complexFilter(filter)

    $ffmpeg
      .on('end', () => resolve(out))
      .on('error', e => reject(e))
      .run()
  })
}

const scale = async video => await _ffmpeg(video, 'mp4', options.SCALE)

const concatMedia = (ext, options) => async files => {
  const names = await Promise.all(resolveFiles(files).map(transcode))
  const namesString = names.join('|')
  const out = await _ffmpeg(`concat:${namesString}`, ext, options)
  names.forEach(unlinkSync)
  return out
}

const concatmp3 = concatMedia('mp3', options.CONCATMP3)

const concatmp4 = concatMedia('mp4', options.CONCATMP4)

const wav2mp3 = async wav => await _ffmpeg(wav, 'mp3')

const transcode = async file => await _ffmpeg(file, 'ts', options.TRANSCODE)

const voiceOver = async files =>
  await _ffmpeg(files, 'mp3', '-y', filters.VOICEOVER)

const watermark = async files =>
  await _ffmpeg(files, 'mp4', '-c:a copy', filters.WATERMARK)

const reframe = async (video, scale = 2.0) =>
  await _ffmpeg(video, 'mp4', options.REFRAME(scale))

const subtitle = async ([video, subtitle]) =>
  await _ffmpeg(video, 'mp4', options.SUBTITLE(subtitle))

const loop = async (file, secs) =>
  await _ffmpeg(
    file,
    fileExt(file),
    options.LOOP_OUTPUT(secs),
    null,
    options.LOOP_INPUT
  )

const concatAV = async files => {
  const [video, audio] = files
  const out = await _ffmpeg(files, 'mp4', options.CONCAT_AUDIO_VIDEO)
  return out
}

const fade = async ({ file, duration }) => {
  const ext = fileExt(file)
  const type = ext === 'mp4' ? 'v' : 'a'
  let filter = filters.FADE(duration)
  filter = type === 'a' ? filter.replace(/fade/g, 'afade') : filter
  return await _ffmpeg(file, ext, options.FADE(type, filter))
}

const caption = async ([
  video,
  videoTitle,
  videoCredits,
  songTitle,
  songCredits,
]) => {
  const lines = [
    [videoTitle, 180],
    [videoCredits, 160, 40],
    [songTitle, 120],
    [songCredits, 100, 40],
  ]

  const filter = lines.map(filters.DRAWTEXT).join(',')
  return await _ffmpeg(video, 'mp4', options.CAPTION, filter)
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
  scale,
}
