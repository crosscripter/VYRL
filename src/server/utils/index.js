const { join, parse } = require('path')
const { ASSET_BASE } = require('../config')
const { readdirSync, unlinkSync } = require('fs')

const plural = (noun, n) => `${noun.toUpperCase()}${n <= 1 ? '' : 'S'}`

const titleCase = str =>
  str
    .toLowerCase()
    .split(' ')
    .map(w => w.replace(w[0], w[0]?.toUpperCase()))
    .join(' ')

const fileExt = file => parse(file).ext.slice(1).trim()

const tempName = ext =>
  `${ASSET_BASE}/${Math.random().toString(13).slice(2)}.temp.${ext}`

const resolveFiles = files =>
  files.map(f => {
    if (f?.startsWith(ASSET_BASE)) return f
    if (f?.startsWith('C:')) return f
    return `${ASSET_BASE}/${f}`
  })

const clean = (pattern = 'temp', except) => {
  const regexp = new RegExp(pattern, 'i')

  const tempFiles = readdirSync(ASSET_BASE)
    .filter(f => !except?.includes(f))
    .filter(f => regexp.test(f))
    .map(f => join(ASSET_BASE, f))

  tempFiles.forEach(f => {
    try {
      unlinkSync(f)
    } catch {}
  })
}

module.exports = { resolveFiles, tempName, fileExt, clean, titleCase, plural }
