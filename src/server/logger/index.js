const chalk = require('chalk')
const { inspect } = require('util')

const log = (...msgs) => {
  const msg = msgs
    .map(x => (typeof x === 'object' ? inspect(x, null, null, true) : x))
    .map(m => m.toString())
    .join(' ')

  console.log(
    chalk`{bold {cyan VYRL} {green ⮞}} {gray ${new Date().toISOString()}}  {white ${msg}}`
  )
}

// TODO: Need to refactor how logging is done
const progress = (module, total, step, name, args) => {
  log(
    chalk`{bold {blue ${module}}} {blue (${step}/${total})} {white ${name}...}`,
    args ? inspect(args, false, null, true) : ''
  )
}

module.exports = { log, progress }
