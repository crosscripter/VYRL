const say = require('say')
const { parse } = require('path')
const { log } = require('../logger')
const { wavToMp3 } = require('../editor/ffmpeg')

const base = './server/public'
const tempName = (ext) =>
  `${base}/${Math.random().toString(13).slice(2)}.${ext}`

const read = async (text) => {
  log('reader: reading "' + text + '"...')
  const output = tempName('mp3')

  return new Promise((res, rej) => {
    say.export(text, null, 1.0, output, async (err) => {
      if (err) {
        log('reader error', err)
        return rej(err)
      }

      const mp3 = await wavToMp3(output)
      log(`Text "${text}" exported to ${mp3}`)
      //   renameSync(output, `./server/public/${output}`)
      return res(parse(mp3).base)
    })
  })
}

module.exports = { read }
