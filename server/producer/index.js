const chalk = require('chalk')
const _ = require('underscore')
const subsrt = require('subsrt')
const { log } = require('../logger')
const getMp3duration = require('get-mp3-duration')
const { readFileSync, writeFileSync } = require('fs')
const { resolveFiles, tempName } = require('../utils')
const { say, transcribe } = require('../reader/reader')
const { pexels, pixabay, download } = require('../downloader')

const {
  concatAV,
  voiceOver,
  watermark,
  caption,
  subtitle,
  concatmp3,
  concatmp4,
  reframe,
  loop,
  fade,
} = require('../editor/ffmpeg')

const INTRO = 'intro.mp4'
const OUTRO = 'outro.mp4'
const WATERMARK = 'watermark.gif'


const getAssets = (type, service) => async spec => {
  let i = 0
  const { [type]: { theme } } = spec  
  const assets = { length: 0, items: [] }
  const items = await service.search(theme, 100)
  
  while (assets.length <= spec.duration) {
    const item = items[i++]
    const { name, artist, url } = item
    const file = await download(url)
    const duration = item?.duration ?? getMp3duration(readFileSync(file))
    log(`(${assets.length}) Downloading`, name, 'by', artist, '(', duration, 's) from', url, '...')  
    assets.length += parseInt(duration, 10)
    assets.items.push({ name, artist, duration, file, url })
  }
  
  log(chalk.green`Found ${assets.items.length} ${theme} ${type}(s)`, JSON.stringify(assets))
  return assets
}

const getVideos = getAssets('video', pexels)
const getAudios = getAssets('audio', pixabay)

const generateCaptions = async (duration, videos, audios) => {
  let pos = 0

  const captionText = (type, item) => {
    const isVideo = type === 'video'
    const icon = isVideo ? '🎥' : '🎵' 
    const source = isVideo ? 'Pexels' : 'Pixabay'
    const { name = type, artist = 'Anonymous' } = item

    return `{\\an1} <font size="10px">${icon} <b>${name}</b></font><br/>
            <font size="8px">${artist} at ${source}</font>`
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
  captions = _.sortBy(captions, (o) => o.start)

  const out = tempName('srt')
  const content = subsrt.build(captions, { format: 'srt' })
  writeFileSync(out, content)
  log('captions generated at', out)
  return out
}

const produce = async (spec) => {
  const { duration } = spec
  const [introDuration, outroDuration] = [5, 7]
  const mediaDuration = duration + introDuration + outroDuration

  const { videos } = await getVideos(spec)
  let video = await Promise.all(videos.map(fade))
  video = await concatmp4(video)
  video = await loop(video, duration)
  
  const captions = await generateCaptions(duration, videos, audios)
  video = await subtitle([video, captions])

  const outro = await fade({ file: OUTRO, duration: outroDuration })
  video = await watermark([video, WATERMARK])
  video = await concatmp4([INTRO, video, outro])
  
  const { audios } = await getAudios(spec)
  let audio = await Promise.all(audios.map(fade))
  audio = await concatmp3(audio)
  audio = await loop(audio, mediaDuration)
  audio = await fade({ file: audio, duration: mediaDuration })
  
  video = await concatAV([video, audio])
  return log(video)
}

module.exports = { produce }
