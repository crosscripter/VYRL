const axios = require('axios')
const pexels = require('./pexels')
const pixabay = require('./pixabay')
const { createWriteStream } = require('fs')
const { tempName } = require('../utils')
const exts = { video: '.mp4', audio: '.mp3' }

const download = async (type, url) => {
  const out = tempName(exts[type])

  return new Promise(async (resolve, reject) => {
    const stream = await axios({ url, method: 'GET', responseType: 'stream' })
    stream.data
      .pipe(createWriteStream(out))
      .on('finish', () => resolve(out))
      .on('error', reject)
  })
}

module.exports = { download, pexels, pixabay }
