const chalk = require('chalk')
const axios = require('axios')
const pexels = require('./pexels')
const { log } = require('../logger')
const pixabay = require('./pixabay')
const { readFileSync } = require('fs')
const { tempName } = require('../utils')
const { createWriteStream } = require('fs')
const getMp3duration = require('get-mp3-duration')
const { EXTS, MAX_PER_PAGE } = require('../config')
const { reject } = require('underscore')
const { resolveSrv } = require('dns')

const download = async (type, url) => {
  const out = tempName(EXTS[type])

  return new Promise(async (resolve, reject) => {
    try {
      const stream = await axios({ url, method: 'GET', responseType: 'stream' })
      stream.data
        .pipe(createWriteStream(out))
        .on('finish', () => resolve(out))
        .on('error', e => reject)
    } catch (e) {
      log('DOWNLOAD ERROR', type, url, e)
      resolve(false)
    }
  })
}

const getAssets = (type, service) => async spec => {
  const {
    [type]: { theme },
  } = spec

  let i = 0
  const assets = { length: 0, items: [] }
  let items = await service.search(theme, MAX_PER_PAGE)

  while (assets.length <= spec.duration) {
    const item = items[i++]

    if (!item) {
      log(chalk`{blue {bold download}} Searching for more ${type}(s)...`)
      i = 0
      items = await service.search(theme, MAX_PER_PAGE)
      continue
    }

    const { name = type, artist = 'Anonymous', url } = item
    if (!url) continue

    const file = await download(type, url)
    if (!file) continue

    const duration = item?.duration ?? getMp3duration(readFileSync(file)) / 1000
    log(
      chalk`{blue {bold download}}: (${assets.items.length}) Downloading`,
      name,
      'by',
      artist,
      '(',
      duration,
      's) from',
      url,
      'to',
      file,
      '...'
    )

    assets.length += parseInt(duration, 10)
    assets.items.push({ name, artist, duration, file, url })
    if (spec.video.count && spec.video.count === assets.items.length) break
  }

  log(
    chalk`{blue {bold search}}: Found ${assets.items.length} ${theme} ${type}(s)`
  )

  return assets
}

const getVideos = getAssets('video', pexels)
const getAudios = getAssets('audio', pixabay)

module.exports = { download, getVideos, getAudios }
