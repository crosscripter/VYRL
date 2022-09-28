const puppeteer = require('puppeteer')
const { sample } = require('underscore')
const { progress } = require('../logger')
const { PIXABAY_URL } = require('../config')
const log = progress.bind(this, 'pixabay', 5)

const search = async theme => {
  console.time('scrapeTracks')
  log(1, `scraping Pixabay for "${theme}" music`)

  const searchUrl = `${PIXABAY_URL}/${theme}`
  log(2, `Opening browser to ${searchUrl}`)
  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()
  await page.goto(searchUrl)

  log(3, `Finding links to music on page`)
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

  log(4, `Closing browser`)
  await browser.close()
  console.timeEnd('scrapeTracks')

  log(5, `Scraped ${tracks.length} ${theme} track(s) from ${searchUrl}`)
  return sample(tracks, tracks.length)
}

module.exports = { search }
