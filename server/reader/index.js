const { Router } = require('express')
const { read } = require('./reader')
const router = Router('reader')

router.get('/', async (req, res) => res.send(`<h1>Reader TTS Engine</h1>`))

router.get('/read', async ({ query: { text } }, res) => {
  const output = await read(text)

  return res.send(`
    <h3><tt><q>${text}</q></tt></h3>
    <br/>
    <audio src="/${output}" controls />
  `)
})

module.exports = router
