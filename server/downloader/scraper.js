const { log } = require('../logger')
const puppeteer = require('puppeteer')
const { sample } = require('underscore')

const scrapeTracks = async (url, theme = 'chill') => {
  log(`scraper: scraping ${url}...`)

  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()
  const searchUrl = `${url}/${theme}`
  await page.goto(searchUrl)

  const tracks = await page.$$eval('.track-main', tracks => {
    return tracks.map(
      ({ children: [a, b, titleChild, c, infoChild, downloadChild] }) => {
        const [nameChild, artistChild] = titleChild.children
        const { innerText: name } = nameChild
        const { innerText: artist } = artistChild
        const { href: url } = downloadChild
        return { name, artist, url }
      }
    )
  })

  await browser.close()
  log(`scraper: scraped ${tracks.length} ${theme} tracks from ${searchUrl}`)
  return sample(tracks, tracks.length)
}

module.exports = { scrapeTracks }
