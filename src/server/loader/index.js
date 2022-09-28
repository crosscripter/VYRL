const { stringify } = JSON
const { log } = require('../logger')
const { ASSET_BASE } = require('../config')
const { readFile } = require('fs').promises
const getMp3Duration = require('get-mp3-duration')
const { default: getVideoDurationInSeconds } = require('get-video-duration')

const loadAssets = async items =>
  await Promise.all(
    items.map(async name => {
      name = `${ASSET_BASE}/${name}`
      log(`loadAssets: Loading asset ${name}...`)

      let info = name.replace(
        /^.*\/(.*?) - (.*?) \((.*?)\)\.(.*)$/gi,
        (_, artist, name, source, ext) =>
          stringify({ artist, name, source, ext })
      )

      info = JSON.parse(info)
      const duration = await (info.ext === 'mp3'
        ? getMp3Duration(await readFile(name))
        : getVideoDurationInSeconds(name))

      info = { ...info, file: name, duration }
      log('info=', stringify(info))
      return info
    })
  )

module.exports = { loadAssets }
