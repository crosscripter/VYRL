const { log } = require('../logger')
const { parse } = require('path')
const sendkeys = require('sendkeys')
const YOUTUBE_URL = 'https://youtube.com/'

const wait = ms => new Promise(res => setTimeout(() => res(true), ms))

const uploadUrl =
  'https://studio.youtube.com/channel/UC7xJpL8WWGUOxvbbHshcmQw/videos/upload?d=ud&filter=%5B%5D&sort=%7B%22columnType%22%3A%22date%22%2C%22sortOrder%22%3A%22DESCENDING%22%7D'

const upload = async video => {
  await sendkeys('^{ESCAPE}')
  await sendkeys('chrome')
  await sendkeys('{ENTER}')

  await wait(3000)
  await sendkeys(uploadUrl)
  await sendkeys('{ENTER}')

  await wait(5000)
  await sendkeys('{TAB}{TAB}{TAB}{ENTER}')
  await sendkeys('C:{ENTER}')
  await sendkeys('users{ENTER}')
  await sendkeys('cross{ENTER}')
  await sendkeys('code{ENTER}')
  await sendkeys('VYRL{ENTER}')
  await sendkeys('server{ENTER}')
  await sendkeys('public{ENTER}')
  await sendkeys(parse(video.videoPath).base + '{ENTER}')

  await wait(5000)
  await sendkeys(video.title)
  await sendkeys('{TAB}{TAB}{TAB}{TAB}{TAB}')
  await sendkeys(video.description)
  await sendkeys('{TAB}{TAB}{TAB}{TAB}{ENTER}')
  await wait(3000)
  await sendkeys(parse(vidoe.thumbnailPath).base + '{ENTER}')
  await sendkeys(
    '{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}'
  )
  await sendkeys(video.hashtags.join(', '))
  await sendkeys(
    '{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}'
  )
  await sendkeys('{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}')
  await sendkeys(video.hashtags.join(', '))
  // await sendkeys('{TAB}{TAB}{TAB}{ENTER}')
}

module.exports = { upload }
