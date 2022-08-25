const { log } = require('../logger')
const puppeteer = require('puppeteer')

const scrape = async (url, genre = 'beautiful plays') => {
  log(`scraper: scraping ${url}...`)

  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()
  await page.goto(`${url}/?genre=${genre}`)

  const tracks = await page.$$eval('a[data-media-type="music"]', (as) =>
    as.map(({ href }) => ({
      name: href.replace(/^.*filename=(.*?)\..*$/, '$1'),
      href,
    }))
  )

  await browser.close()
  log(
    `scraper: scraped ${tracks.length} ${genre} tracks from ${url}/?genre=${genre}`
  )
  return tracks
}

module.exports = { scrape }
