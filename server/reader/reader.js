const say = require('say')
const { parse } = require('path')
const { log } = require('../logger')
const { wav2mp3 } = require('../editor/ffmpeg')

const base = './server/public'
const tempName = (ext) =>
  `${base}/${Math.random().toString(13).slice(2)}.${ext}`

module.exports.say = async (text) => {
  log('tts: saying "' + text + '"...')
  let output = tempName('wav')

  return new Promise((res, rej) => {
    say.export(text, null, 1.0, output, async (err) => {
      if (err) {
        log('tts error', err)
        return rej(err)
      }

      output = await wav2mp3(output)
      log(`tts: Text "${text}" exported to ${output}`)
      return res(parse(output).base)
    })
  })
}
