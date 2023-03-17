const puppeteer = require('puppeteer')
const { sample } = require('underscore')
const log = require('../logger')('pixabay')
const { BASE_URL } = require('../config').clients.pixabay

const search = async theme => {
  console.time('scrapeTracks')
  log('search', `Searching Pixabay for "${theme}" music`)

  const searchUrl = `${BASE_URL}/${theme}`
  log('scrape', `Opening browser to ${searchUrl}`)
  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()
  await page.goto(searchUrl)

  log('scrape', `Finding links to music on page`)
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

  log('scrape', `Closing browser`)
  await browser.close()
  console.timeEnd('scrapeTracks')

  log('search', `Found ${tracks.length} ${theme} track(s) from ${searchUrl}`)
  return sample(tracks, tracks.length)
}

// TODO: Extend with more clients that implement a search API
module.exports = { search }
