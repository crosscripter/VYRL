require('dotenv').config()
const { log } = require('./logger')
const { ASSET_BASE } = process.env

const tempName = (ext) =>
  `${ASSET_BASE}/${Math.random().toString(13).slice(2)}.${ext}`

const resolveFiles = (files) => {
  const names = files.map((f) => `${ASSET_BASE}/${f}`)
  log('utils: resolved media paths', names)
  return names
}

module.exports = { resolveFiles, tempName }
