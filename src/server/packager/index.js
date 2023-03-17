const chalk = require('chalk')
const { inspect } = require('util')
const { existsSync } = require('fs')
const { clean } = require('../utils')
const log = require('../logger')('packager')
const { thumbnail } = require('../editor/ffmpeg')
const { ASSET_BASE } = require('../config').assets
const { mkdir, copyFile, writeFile } = require('fs').promises
const { generateTitle, generateDescription } = require('../captioner')
const { default: getVideoDurationInSeconds } = require('get-video-duration')

const package = async (spec, video, videos, captions, audios, audio) => {
  log('package', 'Generating description')
  const description = await generateDescription(spec)

  log('package', 'Generating thumbnail')
  let thumb = await thumbnail(spec, video)

  log('package', 'Writing output files')
  const copyToDir = (file, name) => copyFile(file, `${dir}/${name}`)

  const writeToFile = (file, contents) =>
    writeFile(`${dir}/${file}`, contents, 'utf8')

  const title = generateTitle(spec)
  const id = `${new Date().toISOString().replace(/\W/g, '').slice(0, -1)}`

  const dir = `${ASSET_BASE}/uploads/YouTube/${id}`
  if (!existsSync(dir)) await mkdir(dir)

  log('package', 'Writing title')
  await writeToFile('title.txt', title)

  log('package', 'Writing description')
  await writeToFile('description.txt', description)

  log('package', 'Writing tags')
  await writeToFile('tags.txt', spec.video.hashtags.join('\n'))

  log('package', 'Copying audio', audio)
  await copyToDir(audio, 'audio.mp3')

  log('package', 'Copying video', video)
  await copyToDir(video, 'video.mp4')

  log('package', 'Copying thumbnail', thumb)
  await copyToDir(thumb, 'thumbnail.png')

  if (spec.captions) {
    log('package', 'Copying captions', captions.file)
    await copyToDir(captions.file, 'captions.srt')
  }

  const duration = await getVideoDurationInSeconds(`${dir}/video.mp4`)
  log('package', 'Cleaning up temp files')
  clean('temp')

  // Output
  log(
    'package',
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
