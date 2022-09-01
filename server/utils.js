require('dotenv').config()
const { parse } = require('path')
const { ASSET_BASE } = process.env

const fileExt = file => parse(file).ext.slice(1).trim()

const tempName = ext =>
  `${ASSET_BASE}/${Math.random().toString(13).slice(2)}.temp.${ext}`

const resolveFiles = files =>
  files.map(f => {
    if (f.startsWith(ASSET_BASE)) return f
    return `${ASSET_BASE}/${f}`
  })

module.exports = { resolveFiles, tempName, fileExt }
