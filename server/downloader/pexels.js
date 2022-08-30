require('dotenv').config()
const axios = require('axios')
const { log } = require('../logger')
const { tempName } = require('../utils')
const { createClient } = require('pexels')
const { basename, parse } = require('path')
const { createWriteStream, existsSync } = require('fs')

const { PEXELS_API_KEY } = process.env
const client = createClient(PEXELS_API_KEY)

const download = async (url) => {
  const fileName = basename(url).split('?')[0].trim()
  const ext = parse(fileName).ext.slice(1)
  const localFilePath = tempName(ext) // join('./server/public', fileName)

  if (existsSync(localFilePath)) {
    log('file', localFilePath, 'exists')
    return localFilePath
  }

  return new Promise(async (res, rej) => {
    try {
      log('Downloading', url, 'to', localFilePath, '...')
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
      })
      log('Writing file stream', localFilePath, '...')
      const stream = response.data.pipe(createWriteStream(localFilePath))
      stream.on('finish', () => {
        log('File written', localFilePath)
        res(localFilePath)
      })
    } catch (err) {
      log('Download failed', err)
      rej(err)
    }
  })
}

const search = async (query, per_page) => {
  log('Searching for', query, 'videos on Pexel...')
  const { videos } = await client.videos.search({ query, per_page })

  return videos
    .map((result) => {
      const {
        duration,
        url,
        width,
        user: { name },
        video_files,
      } = result
      // log(JSON.stringify(result))
      if (width < 1920) return null

      const hdfiles = video_files.filter(
        ({ file_type, quality, width }) =>
          file_type === 'video/mp4' && quality === 'hd'
      )

      const title = url
        .slice(0, -2)
        .split('/')
        .slice(-1)[0]
        .split('-')
        .slice(0, -1)
        .join(' ')

      const hqfile = hdfiles.slice(-1)[0]
      return { url, title, duration, name, video: hqfile.link }
    })
    .filter(Boolean)
}

module.exports = { search, download }
