const chalk = require('chalk')
const _ = require('underscore')
const subsrt = require('subsrt')
const { tempName } = require('../utils')
const { log, progress } = require('../logger')
const getMp3duration = require('get-mp3-duration')
const { readFileSync, writeFileSync } = require('fs')
const { pexels, pixabay, download } = require('../downloader')

const {
  concatAV,
  watermark,
  subtitle,
  concatmp3,
  concatmp4,
  loop,
  fade,
} = require('../editor/ffmpeg')

const INTRO = 'intro.mp4'
const OUTRO = 'outro.mp4'
const WATERMARK = 'watermark.gif'

const getAssets = (type, service) => async spec => {
  let i = 0
  const {
    [type]: { theme },
  } = spec
  const assets = { length: 0, items: [] }
  const items = await service.search(theme, 100)

  while (assets.length <= spec.duration) {
    const item = items[i++]
    const { name, artist, url } = item
    const file = await download(url)
    const duration = item?.duration ?? getMp3duration(readFileSync(file))
    log(
      chalk`{blue {bold download}}: (${assets.length}) Downloading`,
      name,
      'by',
      artist,
      '(',
      duration,
      's) from',
      url,
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
      `{\\an1} <font size="10px">${icon} <b>${name}</b></font><br/>` +
      `<font size="8px">${artist} at ${source}</font>`
    )
  }

  const captionAs = type => item => {
    const start = pos * 1000
    pos += item.duration
    return { start, end: pos * 1000, text: captionText(type, item) }
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

const produce = async spec => {
  const log = progress.bind(this, 'producer', 14)

  const { duration } = spec
  const [introDuration, outroDuration] = [5, 7]
  const mediaDuration = duration + introDuration + outroDuration
  log(1, 'Calculating media durations', {
    duration,
    introDuration,
    outroDuration,
    mediaDuration,
  })

  log(2, 'Searching for video assets', { spec: spec.video })
  const { items: videos } = await getVideos(spec)

  log(3, 'Adding fade transitions to videos', { count: videos.length })
  let video = await Promise.all(videos.map(fade))

  log(4, 'Concatenating video clips', { video, count: videos.length })
  video = await concatmp4(video)

  log(5, 'Looping video to duration', { video, duration })
  video = await loop(video, duration)

  log(10, 'Searching for audio assets', { spec: spec.audio })
  const { items: audios } = await getAudios(spec)

  log(6, 'Generating video/audio captions', { video, videos, audios })
  const captions = await generateCaptions(videos, audios)

  log(7, 'Burning in subtitles', { video, captions })
  video = await subtitle([video, captions])

  log(8, 'Adding fade out transition to outro', { video, OUTRO, outroDuration })
  const outro = await fade({ file: OUTRO, duration: outroDuration })

  log(9, 'Adding watermark to video', { video, WATERMARK })
  video = await watermark([video, WATERMARK])

  log(10, 'Concatenating intro and out to video', { video, INTRO, outro })
  video = await concatmp4([INTRO, video, outro])

  log(11, 'Adding fade to audio', { count: audios.length })
  let audio = await Promise.all(audios.map(fade))

  log(12, 'Concatenating audio tracks', { audio })
  audio = await concatmp3(audio)

  log(13, 'Looping audio to duration', { audio, mediaDuration })
  audio = await loop(audio, mediaDuration)

  log(14, 'Adding fade to audio', { audio, mediaDuration })
  audio = await fade({ file: audio, duration: mediaDuration })

  log(15, 'Mixing audio into video and encoding media', {
    video,
    audio,
    mediaDuration,
  })
  video = await concatAV([video, audio])

  log(16, chalk`Video produced successfully!\n\n{bold {green ${video}}}`, {
    spec,
    mediaDuration,
    video,
    videoCount: videos.length,
    audio,
    audioCount: audios.length,
  })
  return video
}

module.exports = { produce }
