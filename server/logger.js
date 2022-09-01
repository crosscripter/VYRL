const { stringify } = JSON
const chalk = require('chalk')

const log = (...msgs) => {
  const msg = msgs
    .map(x => (typeof x === 'object' ? stringify(x) : x))
    .map(m => '' + m)
    .join(' ')

  console.log(
    chalk`{bold {cyan VYRL} {green ⮞}} {gray ${new Date().toISOString()}} {white ${msg}}`
  )
}

const progress = (module, total, step, name, ...args) =>
  log(
    chalk`{bold {blue ${module}}} {blue (${step}/${total})} {magenta ${name}}:`,
    ...args,
    '...'
  )

module.exports = { log, progress }
