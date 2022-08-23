const { Router } = require('express')
const { read } = require('./reader')
const router = Router('reader')

router.get('/', async (req, res) => res.send(`<h1>Reader TTS Engine</h1>`))

router.get('/read', async ({ query: { text } }, res) => {
  const output = await read(text)

  return res.send(`
    <label>${output}</label>
    <br/>
    <h3 style="max-width:500px;"><blockquote><q><tt>${text}</tt></q></blockquote></h3>
    <audio src="/${output}" controls />
  `)
})

module.exports = router
