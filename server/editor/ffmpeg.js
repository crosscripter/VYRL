const { log } = require('../logger')
const { parse } = require('path')
const { unlinkSync } = require('fs')
const { resolveFiles, fileExt, tempName } = require('../utils')

const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
ffmpeg.setFfmpegPath(ffmpegPath)

const options = {
  CONCATMP3: '-acodec copy',
  LOOP_INPUT: `-stream_loop -1`,
  CONCATMP4: '-c copy -bsf:a aac_adtstoasc',
  LOOP_OUTPUT: secs => `-c copy -t ${secs}`,
  SUBTITLE: file => `-vf subtitles=${file}`,
  REFRAME: scale => `-filter:v setpts=${scale}*PTS`,
  TRANSCODE: '-c copy -bsf:v h264_mp4toannexb -f mpegts'
}

const filters = {
  FADE: duration => `fade=t=in:st=0:d=2,fade=t=out:st=${+duration - 2}:d=2`,
  VOICEOVER: '[0:0]volume=0.3[a];[1:0]volume=2.0[b];[a][b]amix=inputs=2:duration=longest',
  DRAWTEXT: ([text, y, size = 42]) => `drawtext=font=verdana:text='${text}':fontcolor=white:fontsize=${size}:x=20:y=h-th-${y}`,
  WATERMARK: `[1][0]scale2ref=w=oh*mdar:h=ih*0.09[logo][video];` +
             `[video][logo]overlay=10:5:enable='gte(t,5)':format=auto,format=yuv420p;` +
             `[1]format=rgba,colorchannelmixer=aa=0.3[1]`,
}

const _ffmpeg = (inputs, ext, outputOptions, filter, inputOptions) => {
  return new Promise((resolve, reject) => {
    inputOptions = inputOptions?.split(' ')
    outputOptions = outputOptions?.split(' ')

    const out = tempName(ext)
    inputs = resolveFiles(Array.isArray(inputs) ? inputs : [inputs])

    log('ffmpeg', 
        ...inputOptions, 
        ...inputs.map(i => `-i ${i}`), 
        ...outputOptions, 
        filter ? `-filter_complex="${filter}"` : '', 
        out
     )
    
    let $ffmpeg = ffmpeg()
    if (inputOptions) $ffmpeg = $ffmpeg.inputOptions(...inputOptions)

    inputs.forEach((input) => {
      $ffmpeg = $ffmpeg.addInput(input)
    })

    if (outputOptions) $ffmpeg = $ffmpeg.outputOptions(...outputOptions)
    $ffmpeg = $ffmpeg.output(out)

    if (filter) $ffmpeg = $ffmpeg.complexFilter(filter)

    $ffmpeg
      .on('end', () => resolve(out))
      .on('error', (e) => reject(e))
      .run()
  })
}


const concatmp3 = concatMedia('mp3', options.CONCATMP3)

const concatmp4 = concatMedia('mp4', options.CONCATMP4)

const wav2mp3 = async (wav) => await _ffmpeg(wav, 'mp3')

const transcode = async (file) => await _ffmpeg(file, 'ts', options.TRANSCODE)

const voiceOver = async (files) => await _ffmpeg(files, 'mp3', '-y', filters.VOICEOVER)

const watermark = async (files) => await _ffmpeg(files, 'mp4', '-c:a copy', filters.WATERMARK)

const reframe = async (video, scale=2.0) => await _ffmpeg(video, 'mp4', options.REFRAME(scale))

const subtitle = async ([video, subtitle]) =>  await _ffmpeg(video, 'mp4', options.SUBTITLE(subtitle))

const loop = async (file, secs) => await _ffmpeg(file, fileExt(file), options.LOOP_OUTPUT(secs), null, options.LOOP_INPUT)


const concatAV = async (files) => {
  const [video, audio] = files
  log(`ffmpeg: Adding audio ${audio} to video ${video}...`)  
  const out = await _ffmpeg(files, 'mp4', '-c copy -map 0:v -map 1:a')
  log(`ffmpeg: Audio track ${audio} added to ${video} video as ${out} successfully`)
  return out
}

const fade = async ({ file, duration }) => {
  const ext = fileExt(file)
  const type = ext === 'mp4' ? 'v' : 'a'
  let filter = filters.FADE(duration)
  filter = type === 'a' ? filter.replace(/fade/g, 'afade') : filter
  return await _ffmpeg(file, ext, [ `-${type}f`, filter ])
}

const concatMedia = (ext, options) => async (files) => {
  const rfiles = resolveFiles(files)
  const names = await Promise.all(rfiles.map(transcode))
  const namesString = names.join('|')
  log('ffmpeg: concatenating media ', namesString, '...')
  const out = await _ffmpeg(`concat:${namesString}`, ext, options)
  log(`ffmpeg: ${ext}s ${files.join(' ')} concatenated as ${out} successfully`)
  names.forEach(unlinkSync)
  return out
}

const caption = async ([video, videoTitle, videoCredits, songTitle, songCredits]) => {
  log(`ffmpeg: Adding caption "${videoTitle}\n${videoCredits}\n\n${songTitle}\n${songCredits}" to video ${video}...`)
  const lines = [[videoTitle, 180], [videoCredits, 160, 40], [songTitle, 120], [songCredits, 100, 40]]
  const filter = lines.map(filters.DRAWTEXT).join(',')
  return await _ffmpeg(video, 'mp4', ['-codec:a', 'copy'], filter)
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
