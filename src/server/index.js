/**
 * VYRL API Server
 */

const express = require('express')
const log = require('./logger')('server')
const { HOST, PORT } = require('./config').server
const SERVER_URL = `${HOST}:${PORT}`

app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(express.static('./server/public'))
app.get('/', (_, res) => res.send(`VYRL Server`))

app.listen(PORT, async () => {
  console.clear()
  log('launch', `Server launched at http://${SERVER_URL} 🚀`)

  // Produce rain video
  const { produce } = require('./producer')
  await produce(require('./specs/rain.spec'))
})
