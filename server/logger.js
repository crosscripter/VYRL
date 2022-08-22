const chalk = require('chalk')

const log = (...msgs) => {
  const msg = msgs.map((m) => '' + m).join(' ')

  console.log(
    chalk`{bold {cyan VYRL} {green ⮞}} {gray ${new Date().toISOString()}} {white ${msg}}`
  )
}

module.exports = { log }
