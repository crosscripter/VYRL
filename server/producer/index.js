const chalk = require('chalk')
const _ = require('underscore')
const subsrt = require('subsrt')
const { log, progress } = require('../logger')
const { clean, tempName } = require('../utils')
const getMp3duration = require('get-mp3-duration')
const { readFileSync, writeFileSync, renameSync } = require('fs')
const { pexels, pixabay, download } = require('../downloader')

const {
  concatAV,
  watermark,
  subtitle,
  concatmp3,
  concatmp4,
  loop,
  fade,
  scale,
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

const produce = async spec => {
  const log = progress.bind(this, 'producer', 16)

  const { duration } = spec
  const [introDuration, outroDuration] = [5, 7]
  const mediaDuration = duration + introDuration + outroDuration
  log(1, 'Calculating media durations', {
    duration,
    introDuration,
    outroDuration,
    mediaDuration,
  })

  log(2, 'Searching for video assets')
  const { items: videos } = await getVideos(spec)

  log(3, 'Adding fade transitions to videos')
  let video = await Promise.all(videos.map(fade))

  log(4, 'Concatenating video clips')
  video = await concatmp4(video)

  log(5, 'Looping video to duration')
  video = await loop(video, duration)

  log(5.1, 'Scaling video to full HD')
  video = await scale(video)

  log(10, 'Searching for audio assets')
  const { items: audios } = await getAudios(spec)

  log(6, 'Generating video/audio captions')
  const captions = await generateCaptions(videos, audios)

  log(7, 'Burning in subtitles')
  video = await subtitle([video, captions])

  log(8, 'Adding watermark to video')
  video = await watermark([video, WATERMARK])

  log(9, 'Concatenating intro and outro to video')
  video = await concatmp4([INTRO, video, OUTRO])

  log(10, 'Adding fade to audio tracks')
  let audio = await Promise.all(audios.map(fade))

  log(11, 'Concatenating audio tracks')
  audio = await concatmp3(audio)

  log(12, 'Looping audio to duration')
  audio = await loop(audio, mediaDuration)

  log(13, 'Adding fade to audio')
  audio = await fade({ file: audio, duration: mediaDuration })

  log(14, 'Mixing audio into video and encoding media')
  video = await concatAV([video, audio])

  log(15, 'Cleaning up temp files')
  const result = video.replace(/temp/g, 'out')
  renameSync(video, result)
  clean()

  log(16, chalk`Video produced successfully!\n\n{bold {green ${result}}}`, {
    spec,
    mediaDuration,
    video,
    videoCount: videos.length,
    audio,
    audioCount: audios.length,
    result,
  })

  return result
}

module.exports = { produce }
