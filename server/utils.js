require('dotenv').config()
const { log } = require('./logger')
const { ASSET_BASE } = process.env

const tempName = (ext) =>
  `${ASSET_BASE}/${Math.random().toString(13).slice(2)}.${ext}`

const resolveFiles = (files) =>
  files.map((f) => {
    if (f.startsWith(ASSET_BASE)) return f
    return `${ASSET_BASE}/${f}`
  })

module.exports = { resolveFiles, tempName }
