const { Router } = require('express')
const { search, download } = require('./api')
const router = Router('Pexels')

router.get('/', (_, res) => res.send(`<h1>Pexels API</h1>`))

router.get('/search', async ({ query: { query, per_page } }, res) =>
  res.json(await search(query, per_page))
)

router.post('/download', async ({ body: { url } }, res) =>
  res.sendFile(await download(url))
)

module.exports = router
