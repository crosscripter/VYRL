const _ = require('underscore')
const subsrt = require('subsrt')
const striptags = require('striptags')
const { brand } = require('../config')
const { writeFileSync } = require('fs')
const { progress } = require('../logger')
const log = progress.bind(this, 'captioner', 5)
const { toTime, tempName, titleCase } = require('../utils')

const generateCaptions = async (videos, audios) => {
  log(1, 'Generating captions')
  let pos = 0

  const captionText = (type, item) => {
    const isVideo = type === 'video'
    const icon = isVideo ? '🎥' : '🎵'
    const source = isVideo ? 'Pexels' : 'Pixabay'
    const { name = type, artist = 'Anonymous' } = item

    return (
      `{\\an1} <font size="9px">${icon} "<b>${titleCase(name).replace(
        '&amp;',
        '&'
      )}</b>"</font><br/>` + `<font size="8px">${artist} (${source})</font>`
    )
  }

  const captionAs = type => item => {
    const start = pos * 1000
    pos += parseInt(item.duration, 10) ?? 0
    return { start, end: pos * 1000, text: captionText(type, item) }
  }

  log(2, 'Generating video captions')
  const videoCaptions = videos.map(captionAs('video'))

  log(3, 'Generating audio captions')
  pos = 0
  const audioCaptions = audios.map(captionAs('audio'))
  let captions = [...videoCaptions, ...audioCaptions]
  captions = _.sortBy(captions, o => o.start)

  log(4, 'Writing captions SRT subtitle file')
  const out = tempName('srt')
  const content = subsrt.build(captions, { format: 'srt' })
  writeFileSync(out, content)
  log(5, 'Captions generated at', out)
  return { file: out, lines: captions }
}

const generateDescription = async (spec, captions) => {
  const { audio, video } = spec
  const { lines: tracks } = captions

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
${video.hashtags.join(' ')}
`
}

module.exports = { generateCaptions, generateDescription }
