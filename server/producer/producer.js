const { stringify } = JSON
const { join } = require('path')
const { log } = require('../logger')
const { ASSET_BASE } = require('../config')
const { readFile } = require('fs').promises
const { Worker } = require('worker_threads')
const getMp3Duration = require('get-mp3-duration')
const PARALLEL_LIMIT = require('os').cpus().length
const { concatmp3, concatmp4 } = require('../editor/ffmpeg')
const { default: getVideoDurationInSeconds } = require('get-video-duration')

const loadAssets = async items =>
  await Promise.all(
    items.map(async name => {
      name = `${ASSET_BASE}/${name}`
      console.log(`loadAssets: Loading asset ${name}...`)

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
      console.log('info=', stringify(info))
      return info
    })
  )

const Producer = (type, spec) => {
  return new Promise(async resolve => {
    if (spec[type].files) {
      log(1, `Loading ${type} assets from filesystem`, spec[type].files)
      const assets = await loadAssets(spec[type].files)
      const files = assets.map(({ file }) => file)
      const concatter = type === 'video' ? concatmp4 : concatmp3
      const concatted = files.length > 1 ? await concatter(files) : files[0]
      const msg = { [type]: concatted, [`${type}s`]: assets }
      console.log('producer', type, 'result', msg)
      return resolve(msg)
    }

    console.time(type)
    log(1, `Spawing new ${type} producer`)
    const worker = new Worker(join(__dirname, 'workers', `${type}.js`))
    worker.postMessage({ spec, PARALLEL_LIMIT })

    worker.on('message', async msg => {
      console.timeEnd(type)
      log(2.1, `${type} producer sent result`, msg)
      return resolve(msg)
    })
  })
}

module.exports = Producer
