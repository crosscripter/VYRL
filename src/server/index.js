const express = require('express')
const { log } = require('./logger')
const { SERVER_HOST, SERVER_PORT } = require('./config')
const SERVER_URL = `${SERVER_HOST}:${SERVER_PORT}`

app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(express.static('./server/public'))
app.get('/', (_, res) => res.send(`VYRL Server`))

app.listen(SERVER_PORT, async () => {
  console.clear()
  log(`Server launched at http://${SERVER_URL} 🚀`)

  const { produce } = require('./producer')
  const spec = require('./specs/space.spec')
  await produce(spec)
})
