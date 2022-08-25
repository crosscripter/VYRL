const { Router } = require('express')
const router = Router('audio')

router.get('/search', async ({ query: { query } }, res) =>
  res.send('audio search')
)

router.get('/download', async ({ query: { url } }, res) =>
  res.send('audio download')
)

module.exports = router
