const { log } = require('../logger')
const puppeteer = require('puppeteer')

const scrape = async (url, genre = 'beautiful plays') => {
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
        const { href } = downloadChild
        return { name, artist, href }
      }
    )
  })

  // const tracks = await page.$$eval('a[data-media-type="music"]', (as) =>
  //   as.map(({ href }) => ({
  //     name: 'Anonymous',
  //     title: href
  //       .replace(/^.*filename=(.*?)\..*$/, '$1')
  //       .split('-')
  //       .slice(0, -1)
  //       .join(' '),
  //     href,
  //   }))
  // )

  await browser.close()
  log(`scraper: scraped ${tracks.length} ${genre} tracks from ${url}/${genre}`)
  return tracks
}

module.exports = { scrape }
