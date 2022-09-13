const chalk = require('chalk')
const { join } = require('path')
const { progress } = require('../logger')
const { Worker } = require('worker_threads')
const { toTime, clean } = require('../utils')
const getMp3Duration = require('get-mp3-duration')
const { WATERMARK, ASSET_BASE, INTRO, OUTRO } = require('../config')
const { generateCaptions, generateDescription } = require('./captioner')
const { default: getVideoDurationInSeconds } = require('get-video-duration')

const {
  readFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
} = require('fs')

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

const log = progress.bind(this, 'producer', 17)
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
      const duration = await (info.ext === 'mp3'
        ? getMp3Duration(readFileSync(name))
        : getVideoDurationInSeconds(name))

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

  log(12, 'Generating description')
  const description = await generateDescription(spec, captions)

  log(13, 'Generating thumbnail')
  let thumb = await thumbnail(video, `${spec.audio.theme} ${spec.video.theme}`)

  log(14, 'Writing output files')
  const copyToDir = (file, name) => copyFileSync(file, `${dir}/${name}`)

  const writeFile = (file, contents) =>
    writeFileSync(`${dir}/${file}`, contents, 'utf8')

  const hours = toTime(duration).split(':')[0].trim()
  const title = `The BEST ${spec.audio.theme} Tracks and ${spec.video.theme} (${hours} HOURs!)`
  const name = `${spec.audio.theme}_${spec.video.theme}_${new Date()
    .toISOString()
    .replace(/\W/g, '')
    .slice(0, -1)}`

  const dir = `./server/public/uploads/YouTube/${name}`
  if (!existsSync(dir)) mkdirSync(dir)

  log(14.1, 'Writing title')
  writeFile('title.txt', title)

  log(14.2, 'Writing description')
  writeFile('description.txt', description)

  log(14.3, 'Writing tags')
  writeFile('tags.txt', spec.video.hashtags.join('\n'))

  log(14.4, 'Copying audio', audio)
  copyToDir(audio, 'audio.mp3')

  log(14.5, 'Copying video', video)
  copyToDir(video, 'video.mp4')

  log(14.6, 'Copying thumbnail', thumb)
  copyToDir(thumb, 'thumbnail.png')

  if (spec.captions) {
    log(14.7, 'Copying captions', captions.file)
    copyToDir(captions.file, 'captions.srt')
  }

  log(16, 'Cleaning up temp files')
  clean()

  console.timeEnd('produce')

  const product = {
    spec,
    audioCount: audios.length,
    videoCount: videos.length,
    audio: `${dir}/audio.mp3`,
    title,
    duration,
    video: `${dir}/video.mp4`,
    outputDir: dir,
  }

  log(
    17,
    chalk`Video ${name} produced successfully!\n\n{bold {green ${dir}}}\n`,
    product
  )

  return product
}

module.exports = { produce }
