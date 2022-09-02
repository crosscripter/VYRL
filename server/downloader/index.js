const axios = require('axios')
const pexels = require('./pexels')
const pixabay = require('./pixabay')
const { basename } = require('path')
const { createWriteStream } = require('fs')
const { fileExt, tempName } = require('../utils')

const download = async url => {
  const fileName = basename(url).split('?')[0].trim()
  const ext = fileExt(fileName) ?? '.mp4'
  const out = tempName(ext)

  return new Promise(async (resolve, reject) => {
    const stream = await axios({ url, method: 'GET', responseType: 'stream' })
    stream.data
      .pipe(createWriteStream(out))
      .on('finish', () => resolve(out))
      .on('error', reject)
  })
}

module.exports = { download, pexels, pixabay }
