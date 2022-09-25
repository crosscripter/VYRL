const chalk = require('chalk')
const { inspect } = require('util')
const { existsSync } = require('fs')
const { progress } = require('../logger')
const { toTime, clean } = require('../utils')
const { thumbnail } = require('../editor/ffmpeg')
const { generateDescription } = require('./captioner')
const { default: getVideoDurationInSeconds } = require('get-video-duration')
const { mkdir, copyFile, writeFile } = require('fs').promises

const package = async (spec, video, videos, captions, audios, audio) => {
  const log = progress.bind(this, 'packager', 11)
  log(1, 'Generating description')
  const description = await generateDescription(spec, captions)

  log(2, 'Generating thumbnail')
  let thumb = await thumbnail(video, `${spec.audio.theme} ${spec.video.theme}`)

  log(3, 'Writing output files')
  const copyToDir = (file, name) => copyFile(file, `${dir}/${name}`)

  const writeToFile = (file, contents) =>
    writeFile(`${dir}/${file}`, contents, 'utf8')

  const hours = parseInt(toTime(spec.duration).split(':')[0].trim(), 10)
  const title = `The BEST ${spec.audio.theme} Tracks and ${spec.video.theme} (${hours} HOURs!)`

  const id = `${new Date().toISOString().replace(/\W/g, '').slice(0, -1)}`

  const dir = `./server/public/uploads/YouTube/${id}`
  if (!existsSync(dir)) await mkdir(dir)

  log(4, 'Writing title')
  await writeToFile('title.txt', title)

  log(5, 'Writing description')
  await writeToFile('description.txt', description)

  log(6, 'Writing tags')
  await writeToFile('tags.txt', spec.video.hashtags.join('\n'))

  log(7, 'Copying audio', audio)
  await copyToDir(audio, 'audio.mp3')

  log(8, 'Copying video', video)
  await copyToDir(video, 'video.mp4')

  log(9, 'Copying thumbnail', thumb)
  await copyToDir(thumb, 'thumbnail.png')

  if (spec.captions) {
    log(10, 'Copying captions', captions.file)
    await copyToDir(captions.file, 'captions.srt')
  }

  const duration = await getVideoDurationInSeconds(`${dir}/video.mp4`)
  log(11, 'Cleaning up temp files')
  clean()

  console.log(
    chalk.green`\n
    
----------- {bold {green VIDEO PRODUCED }} ----------- 
{bold {yellow INPUT}} 
{white {bold spec}:
${inspect(spec, false, null, true)}  
}

{bold {green OUTPUT}} 
{white {bold id}: ${id}
{bold path}:\t${dir}
{bold video}:\t${dir}/video.mp4 (${videos.length} clips)
{bold audio}:\t${dir}/audio.mp3 (${audios.length} tracks)

{bold duration}:\t${duration}s
{bold title}:\t"${title}"
{bold thumnail}:\t${dir}/thumbnail.png
{bold description}:
${description}

}`
  )

  return dir
}

module.exports = { package }
