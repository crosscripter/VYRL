const say = require('say')
const { parse } = require('path')
const { log } = require('../logger')
const { tempName } = require('../utils')
const { wav2mp3 } = require('../editor/ffmpeg')
const { readFileSync, writeFileSync } = require('fs')

const transcribe = (audio) => {
  const out = tempName('srt')
  const text = readFileSync(`${base}/transcript.srt`, 'utf8')
  writeFileSync(out, text, 'utf8')
  return out
}

const _say = async (text) => {
  log('tts: saying "' + text + '"...')
  let output = tempName('wav')

  return new Promise((res, rej) => {
    say.export(text, 'Microsoft Zira Desktop', 1.0, output, async (err) => {
      if (err) return rej(err)
      output = await wav2mp3(output)
      log(`tts: Text "${text}" exported to ${output}`)
      return res(parse(output).base)
    })
  })
}

module.exports = { say: _say, transcribe }
