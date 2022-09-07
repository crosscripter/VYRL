const chalk = require('chalk')
const _ = require('underscore')
const subsrt = require('subsrt')
const { join } = require('path')
const striptags = require('striptags')
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

const brand = {
  creator: 'VYRL Videos (Michael Schutt)',
  source: 'VYRL :: AI Video Generation Engine',
  video: { source: `Pexels (https://pexels.com/)` },
  audio: { source: `Pixabay (https://pixabay.com/)` },
  streamUrl: 'https://youtube.com/',
  website: 'https://vyrl.video',
  newsletter: 'https://news.vyrl.video',
  subscribe: 'https://bit.ly/3THzfR7',
  playlist: 'https://bit.ly/3qfpprV',
  linkUrl: 'https://linktr.ee/vyrlvideos',
  socials: {
    Facebook: 'https://www.facebook.com/vyrlvids',
    Instagram: 'https://www.instagram.com/vyrl_videos',
    Tumblr: 'https://vyrlvideos.tumblr.com/',
    Reddit: 'https://www.reddit.com/user/VYRLVideos',
    Tiktok: 'https://www.tiktok.com/@vyrlvideos',
    Twitter: 'https://twitter.com/vyrl_videos',
    Spotify: 'https://spotify.com/vyrlvideos',
    Apple: 'https://music.apple.com/vyrlvideos',
    YoutubeMusic: 'https://bit.ly/3qfpprV',
    AmazonMusic: 'https://music.amazon.com/vyrlvideos',
  },
}

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
    const { name = type, artist = 'Anonymous', url } = item
    if (!url) continue
    const file = await download(type, url)
    const duration = item?.duration ?? getMp3duration(readFileSync(file)) / 1000
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
  return { file: out, lines: captions }
}

const generateDescription = async (spec, captions) => {
  const { audio, video } = spec
  const { lines: tracks } = captions

  const toTime = seconds => {
    const date = new Date(null)
    date.setSeconds(seconds / 1000)
    return date.toISOString().substr(11, 8)
  }

  return `
VYRL Videos -- The BEST of the web!

${audio.theme} ${video.theme} video for feeling that ${
    audio.theme
  } vibe and enjoying ${video.theme} scenes!
VYRL provides videos to Fall asleep to, beautiful nature videos to relax to, 
including soothing, meditation and relaxation music for sleeping, focus, studying and more! 

----------------------
Be sure to like and subscribe for more content ${brand.subscribe}
Stream or download music from VYRL at ${brand.streamUrl}

----------------------
💿 Tracks 
${tracks
  .map(
    ({ start, end, text }) =>
      `${toTime(start)} - ${toTime(end)} ${striptags(
        text.replace(/\{\\an1\}/g, '')
      )}`
  )
  .join('\n')}

----------------------
Follow Us all over the web! 
VYRL :: ${brand.linkUrl}
${Object.entries(brand.socials)
  .map(([name, url]) => `${name}: ${url}`)
  .join('\n')}

----------------------
Music courtesy of ${brand.audio.source} 
Footage/photos courtesy of ${brand.video.source}

----------------------
Check out our website at: ${brand.website} 
Binge watch even more VIRAL videos at: ${brand.playlist}
Get a free music download and stay updated with our newsletter: 
${brand.newsletter}

----------------------
© Copyright ${brand.creator} ${new Date().getFullYear()}
Video/Audio created by ${brand.source}

#️ Relevant hashtags:
${video.hashtags}
`
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

const rainVideo = async duration => {
  duration += 13
  const log = progress.bind(this, 'rainVideo', 9)
  console.time()

  log(1, 'Downloading rain video')
  let {
    items: [{ file: video }],
  } = await getVideos({
    duration: 1,
    video: { theme: 'rain rainfall raining storm thunder lightning' },
  })
  console.log('rain video', video)

  log(2, 'Downloading rain audio')
  let audio = 'rain.mp3'

  log(3, 'Looping audio to duration')
  audio = await loop(audio, duration)

  log(4, 'Watermarking video')
  video = await watermark([video, WATERMARK])

  log(5, 'looping video to duration')
  video = await loop(video, duration)

  log(6, 'Adding intro/outro to video')
  video = await concatmp4([INTRO, video, OUTRO])

  log(7, 'Mixing audio into video')
  video = await concatAV([video, audio])

  log(8, 'Cleaning up temp files')
  const result = video.replace(/temp/g, 'out')
  renameSync(video, result)
  clean()

  console.timeEnd()
  log(9, 'Rain video produced at', result)
  return result
}

const produce = async spec => {
  const log = progress.bind(this, 'producer', 9)

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

  let captions = { lines: [] }
  if (spec.captions) {
    log(3, 'Generating video/audio captions')
    captions = await generateCaptions(videos, audios)

    log(4, 'Burning in subtitles')
    video = await subtitle([video, captions.file])
  }

  log(5, 'Concatenating intro and outro to video')
  video = await concatmp4([INTRO, video, OUTRO])

  log(6, 'Mixing audio into video and encoding media')
  video = await concatAV([video, audio])

  log(7, 'Cleaning up temp files')
  const result = video.replace(/temp/g, 'out')
  renameSync(video, result)
  clean()

  console.timeEnd()

  log(8, chalk`Video produced successfully!\n\n{bold {green ${result}}}\n`, {
    spec,
    video,
    videoCount: videos.length,
    audio,
    audioCount: audios.length,
    result,
  })

  log(9, 'Generating description')
  console.log(await generateDescription(spec, captions))
}

module.exports = {
  produce,
  getVideos,
  getAudios,
  WATERMARK,
  rainVideo,
}
