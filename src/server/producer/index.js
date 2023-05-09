const Logger = require('../logger')
const wordwrap = require('wordwrapjs')
const { package } = require('../packager')
const { analyze } = require('../analyzer')
const { Worker } = require('worker_threads')
const Bible = require("../downloader/bible")
const PARALLEL_LIMIT = require('os').cpus().length
const { INTRO, OUTRO } = require('../config').assets
const { generateCaptions } = require('../captioner')
const { fade, fadeText, concatAV, concatmp4, subtitle } = require('../editor/ffmpeg')

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

  log('concat', 'Concatenating intro to video')
  let svideo = await concatmp4([INTRO])

  for (let { text, verse } of passage) {
    const phrases = text.split(/[\,\.\:\;]/)
    
    for (let text of phrases) {
      if (!text.trim()) return 
      
      log('analysis', `Analyzing phrase "${text}" from verse ${verse} for keywords`)
      const [analysis] = analyze(text.trim())
      const { words, sentiment } = analysis

      const mood = sentiment >= 0.5 ? 'uplifting' : 'dramatic'
      let keywords = words.filter(w => w.length >= 5)
      if (!keywords.length) keywords = [mood]
      const theme = keywords.join(' ')
      log('analysis', `Result for "${text}" was`, keywords, sentiment, mood)

      // build spec
      const LINE_DURATION = 5 
      log('analysis', 'line duration', LINE_DURATION)

      const spec = {
        duration: LINE_DURATION * 2,
        audio: { theme: mood, fade: true, count: 1 },
        video: { theme, scale: true, resolution: 'HD', count: 1 },
      }

      log('produce', 'Fetching audio/video assets')
      let [{ audio }, { video }] = await Promise.all(['audio', 'video'].map(type => Producer(type, spec)))
      log('produce', 'Result was ', audio, video)

      log('fade', `Adding fade transitions...`)
      video = await fade({ file: video, duration: spec.duration })

      // Fade in each line of text at different starts
      log('fade', `Fading in line "${text}" for ${LINE_DURATION}secs`)
      video = await fadeText(video, text, LINE_DURATION, LINE_DURATION / 2) 
    
      // Add to the scripture video
      log('CONCAT VIDEOS', svideo, video)
      svideo = await concatmp4([svideo, video])
    }
  }

  await Promise.resolve(true)
  
  log('concat', 'Concatenating outro to video')
  svideo = await concatmp4([svideo, OUTRO])

  log('mixer', 'Mixing audio into video and encoding media')
  svideo = await concatAV([svideo, audio])

  log('produce', "Finished scripture video", svideo)
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
