require('dotenv').config()
const { log } = require('../logger')
const { sample } = require('underscore')
const { createClient } = require('pexels')

const { PEXELS_API_KEY } = process.env
const client = createClient(PEXELS_API_KEY)

const search = async (query, per_page) => {
  log('Searching for', query, 'videos on Pexel...')
  const { videos } = await client.videos.search({ query, per_page })

  const isVideoHD = ({ file_type, quality }) =>
    file_type === 'video/mp4' && quality === 'hd'

  const titleCase = str =>
    str
      .toLowerCase()
      .split(' ')
      .map(w => w.replace(w[0], w[0]?.toUpperCase()))
      .join(' ')

  const getTitleFromUrl = url =>
    url.slice(0, -2).split('/').slice(-1)[0].split('-').slice(0, -1).join(' ')

  return sample(videos, per_page)
    .map(result => {
      const { duration, url, width, user, video_files } = result

      if (duration < 10 || width < 1920) return null
      const name = titleCase(user?.name)
      const title = titleCase(getTitleFromUrl(url))
      const video = video_files.filter(isVideoHD).slice(-1)[0]?.link
      return { artist: name, duration, name: title, url: video }
    })
    .filter(Boolean)
}

module.exports = { search }
