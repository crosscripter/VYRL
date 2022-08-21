const { log } = console
const axios = require('axios')
const { createClient } = require('pexels')
const { basename, resolve } = require('path')
const { createWriteStream, existsSync } = require('fs')

const API_KEY = '563492ad6f91700001000001e841f3975d3f4ca18c5b020bd7109fe6'
const client = createClient(API_KEY)

const downloadFile = async (fileUrl, downloadFolder) => {
  const fileName = basename(fileUrl).split('?')[0].trim()
  const localFilePath = resolve(__dirname, downloadFolder, fileName)

  if (existsSync(localFilePath))  {
    log('file', localFilePath, 'exists')
    return
  }

  try {
    const response = await axios({ method: 'GET', url: fileUrl, responseType: 'stream' })
    const w = response.data.pipe(createWriteStream(localFilePath))

    w.on('finish', () => log('downloaded', fileUrl))
  } catch (err) {
    throw new Error(err)
  }
}

const search = async (query) => {
  const { videos } = await client.videos.search({ query, per_page: 1 })

  return videos.map(({ image, user: { name, url }, video_files }) => {
    const hdfiles = video_files.filter(
      ({ file_type, quality }) => file_type === 'video/mp4' && quality === 'hd'
    )
    const hqfile = hdfiles.slice(-1)[0]
    return { image, url, name, video: hqfile.link }
  })
}

;(async () => {
  const query = 'Nature'
  log('Seaching for', query, '...')
  const videos = await search(query)

  log('Downloading videos...')
  await Promise.all(videos.map(async ({ video }) => 
    await downloadFile(video, `./`)
  ))
})()
