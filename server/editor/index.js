require('dotenv').config()
const { parse } = require('path')
const ffmpeg = require('./ffmpeg')
const { Router } = require('express')
const { media_types } = require('../config')

const router = Router('editor')

router.get('/concat', async ({ query: { files } }, res) => {
  files = files.split(',')
  const ext = parse(files[0]).ext.slice(1)
  const ext2 = parse(files[1]).ext.slice(1)
  const type = media_types[ext]
  const isAV = ext === 'mp4' && ext !== ext2
  const out = await ffmpeg[`concat${isAV ? 'AV' : ext}`](files)

  return res.send(
    `<label>${out}</label>
    <br/>
    <${type} src="/${parse(out).base}" controls autoplay />
  `
  )
})

module.exports = router
