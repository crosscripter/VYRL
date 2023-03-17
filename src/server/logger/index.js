const chalk = require('chalk')
const { inspect } = require('util')

const Logger = ctx => (step, ...args) => {
  const msg = args 
    .map(x => (typeof x === 'object' ? inspect(x, null, null, true) : x))
    .map(m => m.toString())
    .join(' ')

  console.log( chalk`{bold {cyan VYRL} {green ⮞}} {gray ${new Date().toISOString()}}  {bold {blue ${ctx}}} {blue (${step})} {white ${msg}...}`)
}

module.exports = Logger
