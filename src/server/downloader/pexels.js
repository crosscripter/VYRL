const { sample } = require('underscore')
const { titleCase } = require('../utils')
const { createClient } = require('pexels')
const log = require('../logger')('pexels')
const { API_KEY } = require('../config').clients.pexels

const client = createClient(API_KEY)

const search = async (query, per_page) => {
  log('search', 'Searching for', query, 'videos on Pexel...')
  const { videos } = await client.videos.search({ query, per_page })

  const isVideoHD = ({ file_type, quality }) =>
    file_type === 'video/mp4' && quality === 'hd'

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
