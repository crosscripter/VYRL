const { Router } = require('express')
const router = Router('video')
const { search, download } = require('./pexels')

router.get('/search', async ({ query: { query, per_page } }, res) =>
  res.json(await search(query, per_page))
)

router.get('/download', async ({ query: { url } }, res) =>
  res.sendFile(await download(url))
)

module.exports = router
