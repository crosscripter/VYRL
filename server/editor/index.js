const { log } = require('../logger')
const { Router } = require('express')
const router = Router('editor')
const ffmpeg = require('./ffmpeg')

router.post('/concat', async ({ body: { videos } }, res) =>
  res.send(await ffmpeg.concat(videos))
)

module.exports = router
