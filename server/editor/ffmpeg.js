const sharp = require('sharp')
const chalk = require('chalk')
const _ = require('underscore')
const { log } = require('../logger')
const { join, parse, resolve } = require('path')
const { WATERMARK, ASSET_BASE } = require('../config')
const { unlinkSync, existsSync, mkdirSync, readdirSync } = require('fs')
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
  SUBTITLE: file => `-vf subtitles=${file}`, //:force_style='Shadow=0,MarginV=12,MarginH=12'`,
  SCALE: `-vf scale=w=1920:h=1080:force_original_aspect_ratio=1:out_color_matrix=bt709:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:#001326`,
}

const filters = {
  FADE: duration => `fade=t=in:st=0:d=2,fade=t=out:st=${+duration - 2}:d=2`,
  VOICEOVER: () =>
    '[0:0]volume=0.3[a];[1:0]volume=2.0[b];[a][b]amix=inputs=2:duration=longest',
  WATERMARK_IMAGE: () =>
    `[1][0]scale2ref=w=oh*mdar:h=ih*0.1[logo][video];[video][logo]overlay=20:20`,
  WATERMARK: () =>
    `${filters.WATERMARK_IMAGE()}:enable='gte(t,3)':format=auto,format=yuv420p;[1]format=rgba,colorchannelmixer=aa=0.5[1]`,
  DRAWTEXT: (text, x, y, font = 'verdana', size = 50, color = 'white') =>
    `drawtext=fontfile='${font}':text=${text}:fontcolor=${color}:shadowcolor=#000000@0.75:shadowx=30:shadowy=20:fontsize=H/3.3:x=${x}:y=H-th-${y}-30`,
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

const watermark = async (files, ext = 'mp4') =>
  await _ffmpeg(
    files,
    ext,
    ext === 'mp4' ? '-c:a copy' : null,
    (ext === 'mp4' ? filters.WATERMARK : filters.WATERMARK_IMAGE)()
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

const frames = async (video, I) => {
  const name = parse(video).name
  const dir = `${ASSET_BASE}/${name}`
  if (!existsSync(dir)) mkdirSync(dir)

  let inputOptions = ''
  let outputOptions = ''

  if (I) {
    inputOptions = '-skip_frame nokey'
    outputOptions = '-vsync 0 -r 30 -f image2'
  }

  return await _ffmpeg(
    video,
    'png',
    outputOptions,
    null,
    inputOptions,
    `${dir}/%06d.png`
  )
}

const thumbnailImage = async video => {
  log(`thumb: Extracting key frames...`)
  const path = await frames(video, true)
  const dir = parse(path).dir

  log(`thumb: Getting thumbnails...`)
  const thumbs = readdirSync(dir).map(f => `${dir}/${f}`)
  const stats = await Promise.all(
    thumbs.map(async file => {
      const { sharpness } = await sharp(file).stats()
      return { file, sharpness }
    })
  )

  const sharpest = _.sortBy(stats, s => s.sharpness).reverse()
  const thumb = sharpest[0]
  log(`thumb: thumbnail`, sharpest, thumb.file)
  return thumb.file
}

const thumbnail = async (video, name) => {
  log(`thumb: Getting thumbnail image...`)
  const image = await thumbnailImage(video)

  log(`thumb: Shadowing thumbnail...`)
  const shadowed = await _ffmpeg(
    image,
    'png',
    '-frames:v 1 -q:v 2',
    '[0]split[v0][v1];[v0]crop=iw:ih/2,format=rgba,geq=r=0:g=0:b=0:a=255*(Y/H)[fg];[v1][fg]overlay=0:H-h:format=auto'
  )
  const shadowed2 = await _ffmpeg(
    shadowed,
    'png',
    '-frames:v 1 -q:v 2',
    '[0]split[v0][v1];[v0]crop=iw:ih/3,format=rgba,geq=r=0:g=0:b=0:a=-255*(Y/H)[fg];[v1][fg]overlay=0:-10:format=auto'
  )

  const title = name.split(' ').join('\n')
  const font = join(resolve('./'), 'server/public', 'Roboto-Black.ttf').replace(
    /([\:\\])/g,
    '\\$1'
  )

  log(`thumb: Titling thumbnail "${name}"...`)
  const titled = await _ffmpeg(
    shadowed2,
    'png',
    null,
    filters.DRAWTEXT(title.toUpperCase(), 10, 10, font, 360, 'white')
  )

  const _4K = '4K.png'
  log(`thumb: Watermarking with 4k symbol...`)
  const _4ked = await _ffmpeg(
    [titled, _4K],
    'png',
    null,
    '[1]scale=iw/1.8:-1[b];[0:v][b] overlay=W-w-20:H-h-30'
  )

  const watermarkImage = WATERMARK.replace(/.gif/g, '.png')
  log(`thumb: Watermarking VYRL logo...`, _4ked, watermarkImage)
  const out = await watermark([_4ked, watermarkImage], 'png')
  return out
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
  frames,
  thumbnail,
}
