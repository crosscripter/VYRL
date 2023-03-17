const Logger = require('../logger')
const { package } = require('../packager')
const { Worker } = require('worker_threads')
const Bible = require("../downloader/bible")
const { getVideos, getAudios } = require("../downloader")
const PARALLEL_LIMIT = require('os').cpus().length
const { INTRO, OUTRO } = require('../config').assets
const { generateCaptions } = require('../captioner')
const { concatAV, concatmp4, subtitle } = require('../editor/ffmpeg')
const { analyze } = require('../analyzer')
const log = Logger('producer')

const Producer = (type, spec) =>
  new Promise(async resolve => {
    const log = Logger(type)
    console.time(type)
    log('spawn', `Spawing new ${type} producer`)
    const worker = new Worker(`./src/server/workers/${type}.js`)
    worker.postMessage({ spec, PARALLEL_LIMIT })

    worker.on('message', async msg => {
      console.timeEnd(type)
      log('message', `producer sent result`, msg)
      return resolve(msg)
    })
  })

const scriptureVideo = async ref => {
  log('scriptureVideo', `Generating video for ${ref}`)
  const passage = await Bible.passage(ref)

  await Promise.all(passage.map(async ({ text, verse }) => {
    log('analysis', `Analyzing verse ${verse} "${text}" for keywords`)
    const [analysis] = analyze(text.trim())
    const { nouns: keywords, sentiment } = analysis
    log('analysis', `Result was`, keywords, sentiment)

    const theme = keywords.join(' ')
    const mood = sentiment >= 0.5 ? 'uplifting' : 'dramatic'

    const spec = {
      duration: 60,
      video: { theme, count: 1 },
      audio: { theme: mood, count: 1 }
    }

    log('produce', 'Fetching audio/video assets')
    let [{ audio }, { video }] = await Promise.all(['audio', 'video'].map(type => Producer(type, spec)))
    log('produce', 'Result was ', audio, video)
  }))
}

const produce = async spec => {
  console.time('produce')
  log('produce', 'Producing video', spec)

  log('assets', 'Fetching audio/video assets')
  let [{ audio, audios }, { video, videos }] = await Promise.all(
    ['audio', 'video'].map(type => Producer(type, spec))
  )

  let captions = { lines: [] }

  if (spec.captions) {
    log('captions', 'Generating video/audio captions')
    captions = await generateCaptions(videos, audios)

    log('subtitles', 'Burning in subtitles')
    video = await subtitle([video, captions.file])
  }

  log('concat', 'Concatenating intro and outro to video')
  video = await concatmp4([INTRO, video, OUTRO])

  log('mixer', 'Mixing audio into video and encoding media')
  video = await concatAV([video, audio])

  log('package', 'Packaging for upload')
  const output = await package(spec, video, videos, captions, audios, audio)

  console.timeEnd('produce')
  log('produce', 'Video produced', output)

  return output
}

module.exports = { produce, scriptureVideo }
