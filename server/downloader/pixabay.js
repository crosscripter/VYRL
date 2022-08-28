require('dotenv').config()
const { default: axios } = require('axios')
const { log } = require('../logger')
const { scrape } = require('./scraper')
const { PIXABAY_URL } = process.env

const search = async (genre) => {
  log(`pixabay: searching for ${genre} music from ${PIXABAY_URL}...`)
  return scrape(PIXABAY_URL, genre)
}

module.exports = { search }
