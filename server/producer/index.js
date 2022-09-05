const chalk = require('chalk')
const _ = require('underscore')
const subsrt = require('subsrt')
const { join } = require('path')
const { Worker } = require('worker_threads')
const { log, progress } = require('../logger')
const { clean, tempName } = require('../utils')
const getMp3duration = require('get-mp3-duration')
const { pexels, pixabay, download } = require('../downloader')
const { readFileSync, writeFileSync, renameSync } = require('fs')

const {
  concatAV,
  watermark,
  subtitle,
  concatmp3,
  concatmp4,
  loop,
  fade,
} = require('../editor/ffmpeg')

const INTRO = 'intro-full.mp4'
const OUTRO = 'outro-full-fade.mp4'
const WATERMARK = 'watermark.gif'

const getAssets = (type, service) => async spec => {
  let i = 0
  const {
    [type]: { theme },
  } = spec
  const assets = { length: 0, items: [] }

  const MAX_PER_PAGE = 70
  let items = await service.search(theme, MAX_PER_PAGE)

  while (assets.length <= spec.duration) {
    const item = items[i++]
    if (!item) {
      log(chalk`{blue {bold download}} Searching for more ${type}(s)...`)
      i = 0
      items = await service.search(theme, MAX_PER_PAGE)
      continue
    }
    const { name = 'Video', artist = 'Anonymous', url } = item
    if (!url) continue
    const file = await download(url)
    const duration = item?.duration ?? getMp3duration(readFileSync(file))
    log(
      chalk`{blue {bold download}}: (${assets.items.length}) Downloading`,
      name,
      'by',
      artist,
      '(',
      duration,
      's) from',
      url,
      'to',
      file,
      '...'
    )
    assets.length += parseInt(duration, 10)
    assets.items.push({ name, artist, duration, file, url })
  }

  log(
    chalk`{blue {bold search}}: Found ${assets.items.length} ${theme} ${type}(s)`,
    assets
  )
  return assets
}

const getVideos = getAssets('video', pexels)
const getAudios = getAssets('audio', pixabay)

const generateCaptions = async (videos, audios) => {
  let pos = 0

  const captionText = (type, item) => {
    const isVideo = type === 'video'
    const icon = isVideo ? '🎥' : '🎵'
    const source = isVideo ? 'Pexels' : 'Pixabay'
    const { name = type, artist = 'Anonymous' } = item

    return (
      `{\\an1} <font size="10px">${icon} "<b>${name}</b>"</font><br/>` +
      `<font size="8px">${artist} at ${source}</font>`
    )
  }

  const captionAs = type => item => {
    const start = pos * 1000
    pos += item.duration
    return { start, end: pos * 1000 - 500, text: captionText(type, item) }
  }

  const videoCaptions = videos.map(captionAs('video'))

  pos = 0
  const audioCaptions = audios.map(captionAs('audio'))
  let captions = [...videoCaptions, ...audioCaptions]
  captions = _.sortBy(captions, o => o.start)
  log(chalk`{blue {bold captions}}: Generated captions`, captions)

  const out = tempName('srt')
  const content = subsrt.build(captions, { format: 'srt' })
  writeFileSync(out, content)
  log('captions generated at', out)
  return out
}

const Producer = spec => type => {
  return new Promise(resolve => {
    const worker = new Worker(join(__dirname, 'workers', `${type}.js`))
    console.time(type)
    worker.postMessage({ spec })
    worker.on('message', async msg => {
      console.timeEnd(type)
      log(chalk`{bold {blue ${type}}}: Result from ${type} producer`, msg)
      return resolve(msg)
    })
  })
}

const produce = async spec => {
  const log = progress.bind(this, 'producer', 8)

  console.time()
  const { duration } = spec
  const [introDuration, outroDuration] = [5, 7]
  spec.duration = duration + introDuration + outroDuration
  const producer = Producer(spec)

  log(1, 'Calculating media durations', {
    duration,
    introDuration,
    outroDuration,
    totalDuration: spec.duration,
  })

  log(2, 'Spawing audio/video producers...')
  const producers = [producer('video'), producer('audio')]
  let [{ video, videos }, { audio, audios }] = await Promise.all(producers)

  log(3, 'Generating video/audio captions')
  const captions = await generateCaptions(videos, audios)

  log(4, 'Burning in subtitles')
  video = await subtitle([video, captions])

  log(5, 'Concatenating intro and outro to video')
  video = await concatmp4([INTRO, video, OUTRO])

  log(6, 'Mixing audio into video and encoding media')
  video = await concatAV([video, audio])

  log(7, 'Cleaning up temp files')
  const result = video.replace(/temp/g, 'out')
  renameSync(video, result)
  clean()

  console.timeEnd()

  log(8, chalk`Video produced successfully!\n\n{bold {green ${result}}}`, {
    spec,
    video,
    videoCount: videos.length,
    audio,
    audioCount: audios.length,
    result,
  })
}

module.exports = {
  produce,
  getVideos,
  getAudios,
  WATERMARK,
}
