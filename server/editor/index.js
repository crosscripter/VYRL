const { log } = require('../logger')
const { Router } = require('express')
const { parse } = require('path')
const router = Router('editor')
const ffmpeg = require('./ffmpeg')

const types = { mp4: 'video', mp3: 'audio' }

router.get('/concat', async ({ query: { files } }, res) => {
  files = files.split(',')
  const ext = parse(files[0]).ext.slice(1)
  const ext2 = parse(files[1]).ext.slice(1)
  console.log('ext', ext, 'ext2', ext2)
  const type = types[ext]
  const isAV = ext === 'mp4' && ext !== ext2
  await ffmpeg[`concat${isAV ? 'AV' : ext}`](files)
  files.push(`output.${ext}`)

  return res.send(
    files
      .map(
        (file) => `
    <label>${file}</label>
    <${type} src="${file}" />
  `
      )
      .join('<br>')
  )
})

module.exports = router
