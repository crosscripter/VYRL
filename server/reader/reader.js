const say = require('say')
const { parse } = require('path')
const { log } = require('../logger')
const { wavToMp3 } = require('../editor/ffmpeg')

const base = './server/public'
const tempName = (ext) =>
  `${base}/${Math.random().toString(13).slice(2)}.${ext}`

const read = async (text) => {
  log('reader: reading "' + text + '"...')
  const output = tempName('wav')

  return new Promise((res, rej) => {
    say.export(text, null, 1.0, output, async (err) => {
      if (err) {
        log('reader error', err)
        return rej(err)
      }

      log(`Text "${text}" exported to ${output}`)
      return res(parse(output).base)
    })
  })
}

module.exports = { read }
