const chalk = require('chalk')
const _ = require('underscore')
const subsrt = require('subsrt')
const striptags = require('striptags')
const { brand } = require('../config')
const { writeFileSync } = require('fs')
const { tempName } = require('../utils')
const { progress } = require('../logger')
const log = progress.bind(this, 'captioner', 10)

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
${video.hashtags.join(' ')}
`
}

module.exports = { generateCaptions, generateDescription }
