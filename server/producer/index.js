const chalk = require('chalk')
const { join } = require('path')
const { clean } = require('../utils')
const { progress } = require('../logger')
const { Worker } = require('worker_threads')
const getMp3Duration = require('get-mp3-duration')
const { readFileSync, renameSync } = require('fs')
const { WATERMARK, ASSET_BASE, INTRO, OUTRO } = require('../config')
const { generateCaptions, generateDescription } = require('./captioner')
const { default: getVideoDurationInSeconds } = require('get-video-duration')

const {
  fade,
  scale,
  watermark,
  concatAV,
  subtitle,
  thumbnail,
  concatmp3,
  concatmp4,
  loop,
} = require('../editor/ffmpeg')

const log = progress.bind(this, 'producer', 15)
const PARALLEL_LIMIT = require('os').cpus().length

const loadAssets = async items =>
  await Promise.all(
    items.map(async name => {
      name = `${ASSET_BASE}/${name}`
      let info = name.replace(
        /^.*\/(.*?) - (.*?) \((.*?)\)\.(.*)$/gi,
        (_, artist, name, source, ext) =>
          JSON.stringify({ artist, name, source, ext })
      )

      info = JSON.parse(info)
      const duration =
        info.ext === 'mp3'
          ? await getMp3Duration(readFileSync(name))
          : getVideoDurationInSeconds(name)

      info = { ...info, file: name, duration }
      console.log('info=', JSON.stringify(info))
      return info
    })
  )

const produce = async spec => {
  console.time('produce')
  log(1, 'Producing video', spec)

  const Producer = (type, spec) => {
    return new Promise(resolve => {
      console.time(type)
      const worker = new Worker(join(__dirname, 'workers', `${type}.js`))
      worker.postMessage({ spec, PARALLEL_LIMIT })

      worker.on('message', async msg => {
        console.timeEnd(type)
        log(2.1, `${type} producer sent result`, msg)
        return resolve(msg)
      })
    })
  }

  log(2, 'Loading audio/video assets')
  let video, audio
  let videos = spec.video.files
  let audios = spec.audio.files

  if (videos) {
    log(2.1, 'Loading videos from local assets', videos)
    video = await concatmp4(videos)
    videos = await loadAssets(videos)
  } else {
    log(2.2, 'Spawing video producer')
    const result = await Producer('video', spec)
    video = result.video
    videos = result.videos
  }

  if (audios) {
    log(2.3, 'Loading audios from local assets', audios)
    audio = audios.length > 1 ? await concatmp3(audios) : audios[0]
    audios = await loadAssets(audios)
  } else {
    log(2.4, 'Spawing audio producer')
    const result = await Producer('audio', spec)
    audio = result.audio
    audios = result.audios
  }

  log(3, 'Scaling video to full HD')
  if (spec.video.scale) video = await scale(video)

  log(4, 'Watermarking video')
  if (spec.video.watermark) video = await watermark([video, WATERMARK])

  let captions = { lines: [] }

  if (spec.captions) {
    log(5, 'Generating video/audio captions')
    captions = await generateCaptions(videos, audios)

    log(6, 'Burning in subtitles')
    video = await subtitle([video, captions.file])
  }

  log(7, 'Concatenating intro and outro to video')
  video = await concatmp4([INTRO, video, OUTRO])

  log(8, 'Calculating total video duration')
  const duration = await getVideoDurationInSeconds(video)
  console.log('duration', duration)

  log(9, 'Looping audio to video duration')
  audio = await loop(audio, duration)

  if (spec.audio.fade) {
    log(10, 'Adding fade to audio')
    audio = await fade({ file: audio, duration })
  }

  log(11, 'Mixing audio into video and encoding media')
  video = await concatAV([video, audio])
  const result = video.replace(/temp/g, 'out')
  renameSync(video, result)

  log(12, 'Generating description')
  const description = await generateDescription(spec, captions)

  log(13, 'Generating thumbnail')
  let thumb = await thumbnail(result, `${spec.audio.theme} ${spec.video.theme}`)
  const thumbResult = thumb.replace(/temp/g, 'out')
  renameSync(thumb, thumbResult)

  log(14, 'Cleaning up temp files')
  clean()

  console.timeEnd('produce')
  const product = { thumb: thumbResult, video: result, description }
  log(15, chalk`Video produced successfully!\n\n{bold {green ${result}}}\n`, {
    spec,
    video: result,
    videoCount: videos.length,
    audio,
    audioCount: audios.length,
    output: product,
  })

  return product
}

module.exports = { produce }
