require('dotenv').config()
const chalk = require('chalk')
const { ASSET_BASE } = process.env
const { log } = require('./logger')
const { join, parse } = require('path')
const { readdirSync, unlinkSync } = require('fs')

const fileExt = file => parse(file).ext.slice(1).trim()

const tempName = ext =>
  `${ASSET_BASE}/${Math.random().toString(13).slice(2)}.temp.${ext}`

const resolveFiles = files =>
  files.map(f => {
    if (f.startsWith(ASSET_BASE)) return f
    return `${ASSET_BASE}/${f}`
  })

const clean = () => {
  readdirSync(ASSET_BASE)
    .map(f => join(ASSET_BASE, f))
    .filter(f => /temp/.test(f))
    .forEach(f =>
      log(chalk`{bold {blue clean}}: DELETING ${f}...`, (unlinkSync(f), ''))
    )
}

module.exports = { resolveFiles, tempName, fileExt, clean }
