const { log } = require('../logger')
const { Router } = require('express')
const router = Router('editor')
const ffmpeg = require('./ffmpeg')

router.post('/video/concat', async ({ body: { videos } }, res) =>
  res.send(await ffmpeg.concatVideos(videos))
)

router.get('/video/concat', async ({ query: { videos } }, res) => {
  videos = videos.split(',')
  await ffmpeg.concatVideos(videos)
  videos.push('output.mp4')

  return res.send(
    videos
      .map(
        (video) => `
    <label>${video}</label>
    <video src="${video}" />
  `
      )
      .join('<br>')
  )
})

module.exports = router
