const chalk = require('chalk')
const { join } = require('path')
const { log, progress } = require('../logger')
const { resolveFiles, fileExt, tempName, clean } = require('../utils')
const { EXTS, ASSET_BASE, WATERMARK, TITLE_FONT } = require('../config')
const { default: getVideoDurationInSeconds } = require('get-video-duration')

const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
ffmpeg.setFfmpegPath(ffmpegPath)

const options = {
  CAPTION: '-codec:a copy',
  CONCATMP3: '-acodec copy',
  SHADOW: '-frames:v 1 -q:v 2',
  LOOP_INPUT: `-stream_loop -1`,
  TRANSCODE: '-c copy -f mpegts',
  SUBTITLE: file => `-vf subtitles=${file} -c:v libx264`,
  CONCATMP4: '-c copy -bsf:a aac_adtstoasc',
  LOOP_OUTPUT: secs => `-c copy -t ${secs}`,
  THUMBNAIL: '-ss 8 -frames:v 1 -q:v 2 -r 1/1',
  FADE: (type, filter) => `-${type}f ${filter}`,
  CONCAT_AUDIO_VIDEO: '-c copy -map 0:v -map 1:a -shortest',
  WATERMARK: '-c:a copy -shortest',
  REFRAME: scale => `-filter:v setpts=${scale}*PTS`,
  OVERLAY: '-map [out] -map 0:a? -c:a copy',
  SCALE: (w, h) =>
    `-vf scale=w=${w}:h=${h}:force_original_aspect_ratio=1:out_color_matrix=bt709:flags=lanczos,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:#001326`,
}

const filters = {
  THUMBNAIL: () => '-skip_frame nokey',
  BADGE: () => '[1]scale=iw/2:-1[b];[0:v][b] overlay=W-w-30:0',
  FADE: duration => `fade=t=in:st=0:d=2,fade=t=out:st=${+duration - 2}:d=2`,
  VOICEOVER: () =>
    '[0:0]volume=0.3[a];[1:0]volume=2.0[b];[a][b]amix=inputs=2:duration=longest',
  WATERMARK_IMAGE: (scale = 0.125) =>
    `[1][0]scale2ref=w=oh*mdar:h=ih*${scale}[logo][video];[video][logo]overlay=20:12`,
  WATERMARK: scale =>
    `${filters.WATERMARK_IMAGE(
      scale
    )}:format=auto,format=yuv420p;[1]format=rgba,colorchannelmixer=aa=0.2[1]`,
  DRAWTEXT: (text, x, y, font = 'verdana', size = 50, color = 'white') =>
    `drawtext=fontfile='${font}':text=${text}:fontcolor=${color}:shadowcolor=#000000@0.75:shadowx=30:shadowy=20:fontsize=H/3.3:x=${x}:y=H-th-${y}-30`,
  SHADOW_TOP: () =>
    '[0]split[v0][v1];[v0]crop=iw:ih/2,format=rgba,geq=r=0:g=0:b=0:a=255*(Y/H)[fg];[v1][fg]overlay=0:H-h:format=auto',
  SHADOW_BOTTOM: () =>
    '[0]split[v0][v1];[v0]crop=iw:ih/3,format=rgba,geq=r=0:g=0:b=0:a=-255*(Y/H)[fg];[v1][fg]overlay=0:-10:format=auto',
  OVERLAY: (start, end) =>
    `[1][0]scale2ref=w=oh*mdar:h=ih*0.5[1:v][0];[1:v]setpts=PTS+${start}/TB,colorkey=0x00ff00:0.4:0.2[ovrl],[0:0][ovrl]overlay=enable='between(t\,${start}\,${end})':x=W-w-30:y=H-h+20:eof_action=pass[out]`,
}

const _ffmpeg = (inputs, ext, outputOptions, filter, inputOptions, output) =>
  new Promise((resolve, reject) => {
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
    if (!inputOptions.length) $ffmpeg = $ffmpeg.addOption('-threads 1')

    inputs.forEach(input => ($ffmpeg = $ffmpeg.addInput(input)))

    if (inputOptions.length) $ffmpeg = $ffmpeg.inputOptions(...inputOptions)
    if (outputOptions.length) $ffmpeg = $ffmpeg.outputOptions(...outputOptions)

    $ffmpeg = $ffmpeg.outputOptions(['-crf 18', '-preset ultrafast'])
    $ffmpeg = $ffmpeg.output(out)

    if (filter) $ffmpeg = $ffmpeg.complexFilter(filter)

    $ffmpeg
      .on('end', () => resolve(out))
      .on('error', e => reject(e))
      .run()
  })

const scale = (video, w, h) => _ffmpeg(video, EXTS.video, options.SCALE(w, h))

const concatMedia = (ext, options) => async files => {
  if (files.length === 1) {
    console.log('single file skipping transcoding...')
    const [out] = await resolveFiles(files)
    return out
  }

  const names = await Promise.all(resolveFiles(files).map(transcode))
  const out = await _ffmpeg(`concat:${names.join('|')}`, ext, options)
  clean('temp.ts')
  return out
}

const concatmp3 = concatMedia(EXTS.audio, options.CONCATMP3)
const concatmp4 = concatMedia(EXTS.video, options.CONCATMP4)

const wav2mp3 = wav => _ffmpeg(wav, EXTS.audio)
const transcode = file => _ffmpeg(file, 'ts', options.TRANSCODE)
const voiceOver = files => _ffmpeg(files, EXTS.audio, '-y', filters.VOICEOVER())

const watermark = (files, ext = EXTS.video, scale) =>
  _ffmpeg(
    files,
    ext,
    ext === EXTS.video ? options.WATERMARK : null,
    (ext === EXTS.video ? filters.WATERMARK : filters.WATERMARK_IMAGE)(scale)
  )

const reframe = (video, scale = 2.0) =>
  _ffmpeg(video, EXTS.video, options.REFRAME(scale))
const subtitle = ([video, subtitle]) =>
  _ffmpeg(video, EXTS.video, options.SUBTITLE(subtitle))

const loop = (file, secs) =>
  _ffmpeg(
    file,
    fileExt(file),
    options.LOOP_OUTPUT(secs),
    null,
    options.LOOP_INPUT
  )

const concatAV = files => _ffmpeg(files, EXTS.video, options.CONCAT_AUDIO_VIDEO)

const fade = ({ file, duration }) => {
  const ext = fileExt(file)
  const type = ext === EXTS.video ? 'v' : 'a'
  let filter = filters.FADE(duration)
  filter = type === 'a' ? filter.replace(/fade/g, 'afade') : filter
  return _ffmpeg(file, ext, options.FADE(type, filter))
}

const shadow = (filter, image) =>
  _ffmpeg(image, EXTS.image, options.SHADOW, filters[filter]())

const thumbnail = async (spec, video) => {
  const name = `${spec.audio.theme} ${spec.video.theme}`
  const log = progress.bind(this, 'thumb', 6)

  log(1, 'Extracting frame for thumbnail image')
  const image = await _ffmpeg(
    video,
    EXTS.image,
    options.THUMBNAIL,
    null,
    filters.THUMBNAIL()
  )

  log(2, 'Adding shadowing to thumbnail')
  let shadowed = await shadow('SHADOW_TOP', image)
  shadowed = await shadow('SHADOW_BOTTOM', shadowed)

  log(3, 'Resolving font path')
  const title = name.split(' ').join('\n')
  const assetsDir = `${ASSET_BASE}/assets`
  const font = join(assetsDir, TITLE_FONT).replace(/([\:\\])/g, '\\$1')

  log(4, 'Adding title to thumbnail', title.toUpperCase())
  const titled = await _ffmpeg(
    shadowed,
    EXTS.image,
    null,
    filters.DRAWTEXT(title.toUpperCase(), 10, 10, font, 340, 'white')
  )

  let badged = shadowed
  const res = spec.video.resolution

  if (res) {
    const badge = `${ASSET_BASE}/assets/${res}.${EXTS.image}`
    log(5, 'Adding quality badge to thumbnail', badge)
    badged = await _ffmpeg([titled, badge], EXTS.image, null, filters.BADGE())
  }

  const WATERMARK_PNG = WATERMARK.replace('gif', EXTS.image)
  log(6, 'Watermarking thumbnail', WATERMARK_PNG)
  log(`thumb: Watermarking VYRL logo...`, WATERMARK_PNG)
  return watermark([badged, WATERMARK_PNG], EXTS.image, 0.3)
}

const overlay = async files => {
  let [input, green] = resolveFiles(files)
  const duration = await getVideoDurationInSeconds(input)
  const length = await getVideoDurationInSeconds(green)
  const start = (duration / 3).toFixed(0)
  const end = (duration + length).toFixed(0)

  return _ffmpeg(
    [input, green],
    EXTS.video,
    options.OVERLAY,
    filters.OVERLAY(start, end)
  )
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
  overlay,
}
