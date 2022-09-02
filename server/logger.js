const chalk = require('chalk')
const { hrtime } = require('process')
const { inspect } = require('util')

const log = (...msgs) => {
  const msg = msgs
    .map(x => (typeof x === 'object' ? inspect(x, null, null, true) : x))
    .map(m => '' + m)
    .join(' ')

  console.log(
    chalk`{bold {cyan VYRL} {green ⮞}} {gray ${new Date().toISOString()}} {white ${msg}}`
  )
}

const progress = (module, total, step, name, args) => {
  log(
    chalk`{bold {blue ${module}}} {blue (${step}/${total})} {white ${name}...}`,
    args ? inspect(args, false, null, true) : ''
  )
}

module.exports = { log, progress }
