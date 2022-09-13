const sharp = require('sharp')
const chalk = require('chalk')
const _ = require('underscore')
const {
  statSync,
  unlinkSync,
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
  copyFileSync,
} = require('fs')
const { log, progress } = require('../logger')
const { parse, join, resolve } = require('path')
const { ASSET_BASE, WATERMARK } = require('../config')
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
  THUMBNAIL: '-ss 3 -frames:v 1 -q:v 2 -r 1/1',
  FADE: (type, filter) => `-${type}f ${filter}`,
  CONCAT_AUDIO_VIDEO: '-c copy -map 0:v -map 1:a',
  WATERMARK: '-c:a copy -crf 18 -preset ultrafast',
  REFRAME: scale => `-filter:v setpts=${scale}*PTS`,
  TRANSCODE: '-c copy -f mpegts', // -bsf:v h264_mp4toannexb -f mpegts',
  SUBTITLE: file => `-vf subtitles=${file}`,
  SCALE: `-vf scale=w=1920:h=1080:force_original_aspect_ratio=1:out_color_matrix=bt709:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:#001326`,
}

const filters = {
  THUMBNAIL: () => '-skip_frame nokey',
  BADGE: () => '[1]scale=iw/1.5:-1[b];[0:v][b] overlay=W-w-30:24',
  FADE: duration => `fade=t=in:st=0:d=5,fade=t=out:st=${+duration - 3}:d=5`,
  VOICEOVER: () =>
    '[0:0]volume=0.3[a];[1:0]volume=2.0[b];[a][b]amix=inputs=2:duration=longest',
  WATERMARK_IMAGE: (scale = 0.15) =>
    `[1][0]scale2ref=w=oh*mdar:h=ih*${scale}[logo][video];[video][logo]overlay=30:22`,
  WATERMARK: scale =>
    `${filters.WATERMARK_IMAGE(
      scale
    )}:enable='gte(t,3)':format=auto,format=yuv420p;[1]format=rgba,colorchannelmixer=aa=0.25[1]`,
  DRAWTEXT: (text, x, y, font = 'verdana', size = 50, color = 'white') =>
    `drawtext=fontfile='${font}':text=${text}:fontcolor=${color}:shadowcolor=#000000@0.75:shadowx=30:shadowy=20:fontsize=H/3.3:x=${x}:y=H-th-${y}-30`,
  SHADOW_TOP: () =>
    '[0]split[v0][v1];[v0]crop=iw:ih/2,format=rgba,geq=r=0:g=0:b=0:a=255*(Y/H)[fg];[v1][fg]overlay=0:H-h:format=auto',
  SHADOW_BOTTOM: () =>
    '[0]split[v0][v1];[v0]crop=iw:ih/3,format=rgba,geq=r=0:g=0:b=0:a=-255*(Y/H)[fg];[v1][fg]overlay=0:-10:format=auto',
}

const _ffmpeg = (inputs, ext, outputOptions, filter, inputOptions, output) => {
  return new Promise((resolve, reject) => {
    inputOptions = inputOptions?.split(' ') ?? []
    outputOptions = outputOptions?.split(' ') ?? []

    const out = output ?? tempName(ext)

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

    if (!inputOptions.length) {
      $ffmpeg = $ffmpeg.addOption('-threads 1')
    }

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
  await _ffmpeg(files, 'mp3', '-y', filters.VOICEOVER())

const watermark = async (files, ext = 'mp4', scale) =>
  await _ffmpeg(
    files,
    ext,
    ext === 'mp4' ? options.WATERMARK : null,
    (ext === 'mp4' ? filters.WATERMARK : filters.WATERMARK_IMAGE)(scale)
  )

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

const concatAV = async files =>
  await _ffmpeg(files, 'mp4', options.CONCAT_AUDIO_VIDEO)

const fade = async ({ file, duration }) => {
  const ext = fileExt(file)
  const type = ext === 'mp4' ? 'v' : 'a'
  let filter = filters.FADE(duration)
  filter = type === 'a' ? filter.replace(/fade/g, 'afade') : filter
  return await _ffmpeg(file, ext, options.FADE(type, filter))
}

const shadow = async (filter, image) =>
  await _ffmpeg(image, 'png', '-frames:v 1 -q:v 2', filters[filter]())

const thumbnail = async (video, name) => {
  const log = progress.bind(this, 'thumb', 6)

  log(1, 'Extracting frame for thumbnail image')
  const image = await _ffmpeg(
    video,
    'png',
    options.THUMBNAIL,
    null,
    filters.THUMBNAIL()
  )

  log(2, 'Adding shadowing to thumbnail')
  let shadowed = await shadow('SHADOW_TOP', image)
  shadowed = await shadow('SHADOW_BOTTOM', shadowed)

  log(3, 'Resolving font path')
  const title = name.split(' ').join('\n')
  const font = join(
    resolve('./'),
    'server/public/assets',
    'Roboto-Black.ttf'
  ).replace(/([\:\\])/g, '\\$1')

  log(4, 'Adding title to thumbnail', title.toUpperCase())
  const titled = await _ffmpeg(
    shadowed,
    'png',
    null,
    filters.DRAWTEXT(title.toUpperCase(), 10, 10, font, 360, 'white')
  )

  const badge = `${ASSET_BASE}/assets/4K.png`
  log(5, 'Adding quality badge to thumbnail', badge)
  const badged = await _ffmpeg([titled, badge], 'png', null, filters.BADGE())

  const WATERMARK_PNG = WATERMARK.replace('gif', 'png')
  log(6, 'Watermarking thumbnail', WATERMARK_PNG)
  log(`thumb: Watermarking VYRL logo...`, WATERMARK_PNG)
  return await watermark([badged, WATERMARK_PNG], 'png', 0.3)
}

module.exports = {
  concatmp3,
  concatmp4,
  concatAV,
  voiceOver,
  subtitle,
  watermark,
  wav2mp3,
  loop,
  reframe,
  fade,
  scale,
  thumbnail,
}
