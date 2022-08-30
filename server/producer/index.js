const chalk = require('chalk')
const subsrt = require('subsrt')
const _ = require('underscore')
const { readFileSync, writeFileSync } = require('fs')
const pexels = require('../downloader/pexels')
const pixabay = require('../downloader/pixabay')
const getMp3duration = require('get-mp3-duration')
const { getVideoDurationInSeconds } = require('get-video-duration')

const { log } = require('../logger')
const { say, transcribe } = require('../reader/reader')
const {
  concatAV,
  voiceOver,
  watermark,
  caption,
  subtitle,
  concatmp3,
  concatmp4,
  reframe,
  loop,
  fade,
} = require('../editor/ffmpeg')
const { resolveFiles, tempName } = require('../utils')

const INTRO = 'intro.mp4'
const OUTRO = 'outro.mp4'
const WATERMARK = 'watermark.gif'

const getVideos = async (spec) => {
  const {
    video: { theme },
  } = spec

  let i = 0
  const videoInfo = { length: 0, videos: [] }
  const videos = await pexels.search(theme, 100)

  while (videoInfo.length <= spec.duration) {
    const video = videos[i++]
    const { url, title, name, duration, video: href } = video
    log('Downloading', title, 'by', name, '(', duration, 's) from', url, '...')
    const file = await pexels.download(href)
    log(name, '(', duration, 's)')
    videoInfo.length += parseInt(duration, 10)
    log('total length:', videoInfo.length)
    videoInfo.videos.push({
      name: title,
      name,
      artist: name,
      duration,
      file,
      href,
    })
  }

  log(
    chalk.green`Found ${videoInfo.videos.length} ${theme} video(s)`,
    JSON.stringify(videoInfo)
  )

  return videoInfo
}

const getAudios = async (spec) => {
  const {
    audio: { genre },
  } = spec

  let i = 0
  const audioInfo = { length: 0, audios: [] }
  const audios = await pixabay.search(genre, 100)

  while (audioInfo.length <= spec.duration) {
    const audio = audios[i++]
    const { name, artist, href } = audio
    const file = await pexels.download(href)
    const duration = await getMp3duration(readFileSync(file))
    log(
      'Downloading',
      name,
      'by',
      artist,
      '(',
      duration,
      's) from',
      href,
      '...'
    )
    audioInfo.length += parseInt(duration, 10) / 1000
    log('total length:', audioInfo.length)
    audioInfo.audios.push({ name, artist, duration, file, href })
  }

  log(
    chalk.green`Found ${audioInfo.audios.length} ${genre} audio(s)`,
    JSON.stringify(audioInfo)
  )

  return audioInfo
}

const generateCaptions = (duration, videos, audios) => {
  const captions = []

  const getItemAt = (items, at) => {
    let start = 0
    const index = items.findIndex(({ duration }) => duration >= at) ?? 0
    items
      .filter((item, i) => i <= index)
      .map(({ duration }) => (start += duration))
    return { ...items[index], start }
  }

  const addCaption = (changed, ...items) => {
    const [video, audio] = items
    captions.push({
      start: (items[changed].start + 3) * 1000, // from * 1000,
      end: (items[changed].start + 6) * 1000, // to * 1000,
      text:
        `{\\an1} <font size="12px"><b>${video.name ?? 'Video'}</b><br/><i>by ${
          video.artist
        } at Pexels</i><font/>` +
        `<br/><br/><font size="11px"><b>"${
          audio.name ?? 'Music'
        }"</b><br/><i>by ${audio.artist} at Pixabay</i></font>`,
    })
  }

  let _s = 0,
    _video,
    _audio

  for (let s = 0; s < duration; s++) {
    const video = getItemAt(videos, s)
    const audio = getItemAt(audios, s)
    if (video !== _video) {
      addCaption(0, video, audio)
      _video = video
    }
    if (audio !== _audio) {
      addCaption(1, video, audio)
      _audio = audio
    }
    _s = s
  }

  const out = tempName('srt')
  const content = subsrt.build(captions, { format: 'srt' })
  writeFileSync(out, content)
  log('captions generated at', out)
  return out
}

const produce = async (spec) => {
  const { duration } = spec
  const { audios } = await getAudios(spec)
  const { videos } = await getVideos(spec)

  let video = await Promise.all(
    videos.map(async ({ file, duration }) => await fade({ file, duration }))
  )
  let audio = await Promise.all(
    audios.map(async ({ file, duration }) => await fade({ file, duration }))
  )

  video = await concatmp4(video)
  video = await loop(video, duration)
  video = await fade({ file: video, duration })

  audio = await concatmp3(audio)
  // audio = await fade({ file: audio, duration })

  const captions = await generateCaptions(duration, videos, audios)
  video = await subtitle([video, captions])
  const outro = await fade({ file: OUTRO, duration: 7 })
  video = await watermark([video, WATERMARK])
  video = await concatmp4([INTRO, video, outro])
  audio = await loop(audio, duration + 12)
  video = await concatAV([video, audio])

  return log(video)
}

// const produce = async ({
//   video,
//   videoTitle,
//   videoCredits,
//   song,
//   songTitle,
//   songCredits,
//   transcript,
// }) => {
//   log(chalk`produce: {yellow {bold WAIT}} Producing video "${videoTitle}"...`)

//   log(chalk`produce: {yellow {bold WAIT}} Watermarking video...`)
//   video = await watermark([video, WATERMARK])

//   if (videoTitle || videoCredits || songTitle || songCredits) {
//     log(chalk`produce: {yellow {bold WAIT}} Adding captions...`)
//     video = await caption([
//       video,
//       videoTitle,
//       videoCredits,
//       songTitle,
//       songCredits,
//     ])
//   }

//   log(`produce: {yellow {bold WAIT}} Adding intro and outro...`)
//   video = await concatmp4([INTRO, video, OUTRO])

//   let audio
//   if (transcript) {
//     log(chalk`produce: {yellow {bold WAIT}} Generating voice over...`)
//     const speech = await say(transcript)
//     audio = await voiceOver([song, speech])
//   } else {
//     audio = song
//   }

//   log(chalk`produce: {yellow {bold WAIT}} Mixing audio...`)
//   video = await concatAV([video, audio])

//   if (transcript) {
//     log(chalk`produce: {yellow {bold WAIT}} Adding subtitles...`)
//     const subtitles = await transcribe(transcript)
//     video = await subtitle([video, subtitles])
//   }

//   log(chalk`{green {bold DONE}} video ${videoTitle} produced at ${video}`)
//   return video
// }

// const generate = async (visuals, genre) => {
//   log(
//     chalk`generate: {yellow {bold WAIT}} Generating "${visuals}" video with "${genre}" music...`
//   )

//   //Audio
//   log(
//     chalk`generate: {yellow {bold WAIT}} Searching Pixabay for "${genre}" tracks...`
//   )
//   const raudio = _.sample(await pixabay.search(genre))
//   const { name: songTitle, href } = raudio
//   const songCredits = '@Anonymous at Pixabay'

//   log(
//     chalk`generate: {yellow {bold WAIT}} Found audio "${songTitle}" by "${songCredits}" at\n${href}`
//   )
//   const song = await pexels.download(raudio.href)
//   log(
//     chalk`generate: {yellow {bold WAIT}} Downloaded audio "${songTitle}" by "${songCredits}" from ${href} to ${song}`
//   )

//   // Video
//   log(
//     chalk`generate: {yellow {bold WAIT}} Searching Pexels for "${visuals}" videos..`
//   )
//   const rvideos = _.sample(await pexels.search(visuals, 10), 3)

//   const cvideos = await Promise.all(
//     rvideos.map(async (rvideo, i) => {
//       log('rvideo', i, JSON.stringify(rvideo))
//       const { name: videoTitle, url, video } = rvideo
//       const videoCredits = rvideo.name

//       log(
//         chalk`generate: {yellow {bold WAIT}} Found video "${videoTitle}" by "${videoCredits}" at\n${video}`
//       )
//       let videoFile = await pexels.download(rvideo.video)
//       log(
//         chalk`generate: {yellow {bold WAIT}} Downloaded video "${videoTitle}" by "${videoCredits}" from ${video} to ${videoFile} `
//       )

//       videoFile = await caption([
//         videoFile,
//         videoTitle,
//         videoCredits,
//         songTitle,
//         songCredits,
//       ])

//       videoFile = await loop(video, 120)
//       return videoFile
//     })
//   )

//   log('cvideos=', JSON.stringify(cvideos))
//   const videoFile = await concatmp4(cvideos)

//   return await produce({
//     video: videoFile,
//     videoTitle: '',
//     videoCredits: '',
//     song,
//     songTitle: '',
//     songCredits: '',
//     transcript: '',
//   })
// }

// const getItems =
//   (type, service, prop, concat) => async (query, count, duration) => {
//     log(chalk`Finding ${count} ${query} ${type}s of ${duration}s....`)
//     const items = _.sample(await service.search(query, count), count)
//     if (!items.length) throw `No ${type} found for ` + query
//     log(chalk`Found ${items.length} item(s): ${JSON.stringify(items)}`)

//     const files = await Promise.all(
//       items.map(async (item) => {
//         log(chalk`Downloading ${item[prop]}...`)
//         let file = await pexels.download(item[prop])
//         log(chalk`Downloaded ${item[prop]} to ${file}...`)
//         // file = await loop(file, duration)
//         return file
//       })
//     )

//     const [first, ...rest] = files
//     const result = await concat([first, ...rest])
//     log(chalk`${type} result: ${result}`)
//     return result
//   }

// const getVideos = getItems('video', pexels, 'video', concatmp4)

// const getAudios = getItems('audio', pixabay, 'href', concatmp3)

// const rainVideo = async (duration) => {
//   log(chalk`Generating rain video of ${duration}s...`)
//   let video = await getVideos('toes', 50)
//   log('\n\nvideo', video)
//   let audio = await getAudios('drama', 40)
//   log('\n\naudio', audio)
//   return await concatAV([video, audio])
// }

// const video = async ({ video, audio, duration }) => {
//   const [videoFile, audioFile] = resolveFiles([video.file, audio.file])
//   const wvideoFile = await watermark([videoFile, WATERMARK])

//   const cvideoFile = await caption([
//     wvideoFile,
//     video.title,
//     video.author,
//     audio.title,
//     audio.author,
//   ])

//   const videoOut = await loop(cvideoFile, duration)
//   const audioOut = await loop(audioFile, duration)
//   const outFile = await concatAV([videoOut, audioOut])
//   log(chalk`produce: {bold {green DONE}} Video produced at ${outFile}`)
//   return outFile
// }

module.exports = { produce } //, generate, rainVideo, video }
