const _ = require('underscore')
const { build } = require('subsrt')
const { brand } = require('../config')
const { writeFileSync } = require('fs')
const log = require('../logger')('captioner')
const { plural, tempName, titleCase } = require('../utils')

const generateTitle = spec => {
  const mins = Math.floor(spec.duration / 60)
  const hours = Math.floor(spec.duration / 3600)

  const duration =
    hours >= 1
      ? `${hours} ${plural('hour', hours)}`
      : `${mins} ${plural('minute', mins)}`

  const name = `${spec.audio.theme} ${spec.video.theme.toUpperCase()}`
  const keywords = `Relax, Study, Work or Meditation Music`
  const title = `${name} ${spec.video.resolution} - ${keywords} (${duration}!)`
  return title
}

const generateCaptions = async (videos, audios) => {
  let pos = 0
  log('caption', 'Generating captions')

  const captionText = (type, item) => {
    const isVideo = type === 'video'
    const icon = isVideo ? '🎬' : '🎵'
    const source = isVideo ? 'Pexels' : 'Pixabay'
    const { name = type, artist = 'Anonymous' } = item

    return (
      `{\\an1} <font size="8px">${icon} "<b>${titleCase(name).replace(
        '&amp;',
        '&'
      )}</b>"</font><br/>` + `<font size="7px">${artist} (${source})</font>`
    )
  }

  const captionAs = type => item => {
    const start = pos * 1000
    pos += +item.duration
    return { start, end: pos * 1000, text: captionText(type, item) }
  }

  log('video', 'Generating video captions')
  const videoCaptions = videos.map(captionAs('video'))

  log('audio', 'Generating audio captions')
  pos = 0
  const audioCaptions = audios.map(captionAs('audio'))
  let captions = [...videoCaptions, ...audioCaptions]
  captions = _.sortBy(captions, o => o.start)

  log('SRT', 'Writing captions SRT subtitle file')
  const out = tempName('srt')
  const last = captions.slice(-1)[0]
  last.end = videos.slice(-1)[0].duration * 1000
  const content = build(captions, { format: 'srt' })
  writeFileSync(out, content)
  log('SRT', 'Captions generated at', out)
  return { file: out, lines: captions }
}

const generateDescription = async spec => {
  const { video } = spec

  return `
VYRL Videos Presents "${generateTitle(spec)}"

VYRL provides #videos to Fall asleep to, #beautiful #nature videos to #relax to, 
including #soothing, #meditation and #relaxation #music for #sleeping, #focus, #studying and more! 

------------------------------------------------------------------------------------------------------------
Be sure to LIKE and SUBSCRIBE for more content  
${brand.subscribe}

Stream or download music from VYRL at 
${brand.streamUrl}

------------------------------------------------------------------------------------------------------------
Follow us all over the web! 

${Object.entries(brand.socials)
  .map(([name, url]) => `${name}: ${url}`)
  .join('\n')}

-----------------------------------------------------------------------------------------------------------
Music courtesy of
${brand.audio.source} 

Footage/photos courtesy of
${brand.video.source}

#Binge watch even more #VIRAL videos at:
${brand.playlist}

-----------------------------------------------------------------------------------------------------------
#️ Relevant hashtags:
${video.hashtags.join(' ')}

-----------------------------------------------------------------------------------------------------------
© Copyright ${brand.creator} ${new Date().getFullYear()}
Video/Audio created by ${brand.source}
`
}

module.exports = { generateCaptions, generateTitle, generateDescription }
