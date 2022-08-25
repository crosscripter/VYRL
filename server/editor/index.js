require('dotenv').config()
const { log } = require('../logger')
const { parse } = require('path')
const ffmpeg = require('./ffmpeg')
const { Router } = require('express')
const { media_types } = require('../config')

const router = Router('editor')

const htmlMedia = (type, out) => `
<label>${out}</label>
<br/>
<${type} src="/${parse(out).base}" controls />
`

router.get('/concat', async ({ query: { files } }, res) => {
  files = files.split(',')
  const ext = parse(files[0]).ext.slice(1)
  const ext2 = parse(files[1]).ext.slice(1)
  const type = media_types[ext]
  const isAV = ext === 'mp4' && ext !== ext2
  const out = await ffmpeg[`concat${isAV ? 'AV' : ext}`](files)
  return res.send(htmlMedia(type, out))
})

router.get('/voiceover', async ({ query: { files } }, res) => {
  const out = await ffmpeg.voiceOver(files.split(','))
  return res.send(htmlMedia('audio', out))
})

router.get('/subtitle', async ({ query: { files } }, res) => {
  const out = await ffmpeg.subtitle(files.split(','))
  return res.send(htmlMedia('video', out))
})

router.get('/watermark', async ({ query: { files } }, res) => {
  const out = await ffmpeg.watermark(files.split(','))
  return res.send(htmlMedia('video', out))
})

module.exports = router
