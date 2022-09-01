require('dotenv').config()
const { log } = require('../logger')
const { scrapeTracks } = require('./scraper')
const { PIXABAY_URL } = process.env

const search = async theme => {
  log(`pixabay: searching for ${theme} music from ${PIXABAY_URL}...`)
  return await scrapeTracks(PIXABAY_URL, theme)
}

module.exports = { search }
