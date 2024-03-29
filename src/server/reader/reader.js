const say = require('say')
const { tempName } = require('../utils')
const log = require('../logger')('reader')
const { wav2mp3 } = require('../editor/ffmpeg')
const { readFileSync, writeFileSync } = require('fs')

const transcribe = () => {
  log('transcribe', 'Transcribing audio')
  const out = tempName('srt')
  const text = readFileSync(`${base}/transcript.srt`, 'utf8')
  writeFileSync(out, text, 'utf8')
  return out
}

const _say = async text => {
  log('TTS', 'Saying "' + text + '"...')
  let out = tempName('wav')

  return new Promise((res, rej) => {
    say.export(text, 'Microsoft Zira Desktop', 1.0, out, async err => {
      if (err) return rej(err)
      out = await wav2mp3(out)
      log('TTS', `Text "${text}" exported to ${out}`)
      return res(out)
    })
  })
}

module.exports = { say: _say, transcribe }
