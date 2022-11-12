const { log } = require('../logger')
const { ASSET_BASE } = require('../config')
const { readFile } = require('fs').promises
const getMp3Duration = require('get-mp3-duration')
const { default: getVideoDurationInSeconds } = require('get-video-duration')

const getDuration = async (name, ext) =>
  await (ext === 'mp3'
    ? getMp3Duration(await readFile(name))
    : getVideoDurationInSeconds(name))

const parseInfo = async name => {
  const json = name.replace(
    /^.*\/(.*?) - (.*?) \((.*?)\)\.(.*)$/gi,
    (_, artist, name, source, ext) =>
      JSON.stringify({ artist, name, source, ext })
  )

  const info = JSON.parse(json)
  const duration = await getDuration(name, info.ext)
  return { ...info, file: name, duration }
}

const loadAssets = async items =>
  await Promise.all(
    items.map(async name => {
      const path = `${ASSET_BASE}/${name}`
      log(`loadAssets: Loading asset ${path}...`)
      return await parseInfo(path)
    })
  )

module.exports = { loadAssets }
