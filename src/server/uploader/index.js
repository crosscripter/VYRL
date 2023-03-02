const { log } = require('../logger')
const sendkeys = require('sendkeys')
const { readFileSync } = require('fs')
const { join, resolve, parse } = require('path')

const wait = ms => new Promise(res => setTimeout(res, ms))

const upload = async videoPath => {
  log(`Uploading video ${videoPath}`)
  const skescape = text => escape(text).replace(/%/gm, '+5')
  const title = skescape(readFileSync(`${videoPath}/title.txt`).toString())
  const description = skescape(
    readFileSync(`${videoPath}/description.txt`).toString()
  )
  const tags = readFileSync(`${videoPath}/tags.txt`)
    .toString()
    .split(' ')
    .map(skescape)

  log('Opening start menu')
  await sendkeys('^{ESCAPE}')

  log('Opening chrome')
  await sendkeys('chrome')
  await sendkeys('{ENTER}')

  log('Go to channel upload page')
  await sendkeys('^L')
  const UPLOAD_URL = `https://studio.youtube.com/channel/UC7xJpL8WWGUOxvbbHshcmQw/videos/upload?d=ud`
  await sendkeys(UPLOAD_URL)
  await sendkeys('{ENTER}')

  await wait(5000)
  log('Click the upload button')
  await sendkeys('{TAB}{TAB}{TAB}{ENTER}')

  log('Type the file to upload')
  await wait(2000)
  await sendkeys(resolve(videoPath) + '{ENTER}')
  await wait(2000)
  await sendkeys('video.mp4{ENTER}')

  await wait(10000)
  log('Inject script into upload page')
  await sendkeys('^+J')
  await wait(1000)
  await sendkeys('{F6}{F6}{F6}{F6}')
  await wait(1000)

  await sendkeys(
    `const video = +[ title: '${title}', description: '${description}', tags: [${tags
      .map(x => `'${x}'`)
      .join(', ')}] +];+{ENTER}`
  )

  await wait(3000)
  await sendkeys(
    `let [+4title, +4description] = document.querySelectorAll+9'#textbox'+0;`
  )
  await sendkeys('{ENTER}')
  await wait(3000)
  await sendkeys(`+4title.textContent = unescape+9video.title+0;`)
  await sendkeys('{ENTER}')

  await wait(3000)
  await sendkeys(`+4description.textContent = unescape+9video.description+0;`)
  await sendkeys('{ENTER}')

  await wait(3000)
  await sendkeys(
    `let [a, +4tags] = document.querySelectorAll+9'#text-input'+0;`
  )
  await sendkeys('{ENTER}')

  await wait(3000)
  await sendkeys(`+4tags.value = unescape+9video.tags.toString+9+0+0;{ENTER}`)
  await sendkeys('{ENTER}')

  await wait(3000)
  log('Clicking next button')
  // await sendkeys('^+J')
  await sendkeys(`document.querySelector+9'#next-button'+0.click+9+0;{ENTER}`)

  await wait(3000)
  log('Clicking next button again')
  // await sendkeys('^+J')
  await sendkeys(`document.querySelector+9'#next-button'+0.click+9+0;{ENTER}`)

  await wait(3000)
  log('Clicking next button again')
  // await sendkeys('^+J')
  await sendkeys(`document.querySelector+9'#next-button'+0.click+9+0;{ENTER}`)

  await wait(3000)
  log('Setting video privacy...')
  await sendkeys(
    `document.querySelectorAll+9'.tp-yt-paper-radio-button'+0[6].click+9+0;{ENTER}`
  )
  await sendkeys('{ENTER}')

  await wait(3000)
  log('Saving video!')
  await sendkeys(`document.querySelector+9'#done-button'+0.click+9+0;{ENTER}`)
}

module.exports = { upload }
