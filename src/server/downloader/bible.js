
const axios = require('axios')
const log = require('../logger')('bible')
const api = axios.create({ baseURL: 'https://bible-api.com/' })

const passage = async ref => {
    log('passage', `Fetching ${ref}`)
    const res = await api.get(ref)
    if (!res?.data) throw `Could not fetch reference ${ref}!`
    log('passage', `Fetched ${ref}`, res.data.verses)
    return res.data.verses
}

module.exports = { passage }
