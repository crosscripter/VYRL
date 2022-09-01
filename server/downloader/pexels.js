require('dotenv').config()
const { log } = require('../logger')
const { createClient } = require('pexels')

const { PEXELS_API_KEY } = process.env
const client = createClient(PEXELS_API_KEY)

const search = async (query, per_page) => {
  log('Searching for', query, 'videos on Pexel...')
  const { videos } = await client.videos.search({ query, per_page })

  const isVideoHD = ({ file_type, quality }) =>
    file_type === 'video/mp4' && quality === 'hd'

  const getTitleFromUrl = url =>
    url.slice(0, -2).split('/').slice(-1)[0].split('-').slice(0, -1).join(' ')

  return videos
    .map(result => {
      const {
        duration,
        url,
        width,
        user: { name },
        video_files,
      } = result

      if (duration < 10 || width < 1920) return null
      const title = getTitleFromUrl(url)
      const video = video_files.filter(isVideoHD).slice(-1)[0]?.link
      return { title, duration, name, url: video }
    })
    .filter(Boolean)
}

module.exports = { search }
