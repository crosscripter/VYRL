const say = require('say')
const { log } = require('../logger')
const { renameSync } = require('fs')

const read = async (text) => {
  log('reader: reading "' + text + '"...')
  const output = 'output.mp3'

  return new Promise((res, rej) => {
    say.export(text, null, 1.0, output, (err) => {
      if (err) {
        log('reader error', err)
        return rej(err)
      }

      log(`Text "${text}" exported to ${output}`)
      renameSync(output, `./server/public/${output}`)
      return res(output)
    })
  })
}

module.exports = { read }
