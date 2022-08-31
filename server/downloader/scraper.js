const { log } = require('../logger')
const puppeteer = require('puppeteer')

const scrapeTracks = async (url, genre = 'chill') => {
  log(`scraper: scraping ${url}...`)

  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()
  await page.goto(`${url}/${genre}`)

  const tracks = await page.$$eval('.track-main', (tracks) => {
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
  log(`scraper: scraped ${tracks.length} ${genre} tracks from ${url}/${genre}`)
  return tracks
}

module.exports = { scrapeTracks }
