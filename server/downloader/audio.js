const { Router } = require('express')
const router = Router('audio')
const { search } = require('./pixabay')

router.get('/search', async ({ query: { genre } }, res) => {
  const tracks = await search(genre)
  return res.send(`
    ${tracks
      .map(
        ({ name, href }) => `
            <label>${name}</label>
            <br/>
            <audio src="${href}" controls></audio>
            `
      )
      .join('<br/>')}`)
})

router.get('/download', async ({ query: { url } }, res) => res.redirect(url))

module.exports = router
