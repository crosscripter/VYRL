const { progress } = require('../logger')

const {
  Lexicon,
  RuleSet,
  WordTokenizer,
  PorterStemmer,
  BrillPOSTagger,
  SentenceTokenizer,
  SentimentAnalyzer,
} = require('natural')

const LANG = 'EN'
const DEFAULT_CAT = 'N'
const DEFAULT_CAT_CAP = 'NNP'

const ruleSet = new RuleSet(LANG)
const lexicon = new Lexicon(LANG, DEFAULT_CAT, DEFAULT_CAT_CAP)

const analyze = text => {
  const log = progress.bind(this, 'reader', 6)
  log(1, 'Analyzing text', text)

  log(2, 'Tokenizing sentences')
  let sentences = text
    .split(/\r|\n|\r\n/g)
    .map(x => x.trim())
    .filter(Boolean)

  // sentences = new SentenceTokenizer().tokenize(text)
  log('sentences=', sentences.length)

  const analysis = sentences.map(sentence => {
    log(3, 'Detecting sentiment')
    const words = new WordTokenizer().tokenize(sentence)

    const sentiment = new SentimentAnalyzer(
      'English',
      PorterStemmer,
      'afinn'
    ).getSentiment(words)

    log(4, 'Classifying parts of speech')
    const tagger = new BrillPOSTagger(lexicon, ruleSet)
    const { taggedWords } = tagger.tag(words)

    const nouns = taggedWords
      .filter(({ tag }) => /^N/.test(tag))
      .map(({ token }) => token)

    log(5, 'Extracting keywords')
    const keywords = PorterStemmer.tokenizeAndStem(sentence)

    return { sentence, words, keywords, nouns, sentiment }
  })

  log(6, 'Analysis complete', analysis)
  return analysis
}

module.exports = { analyze }
