const log = require('../logger')('analyzer')

const {
  Lexicon,
  RuleSet,
  WordTokenizer,
  PorterStemmer,
  BrillPOSTagger,
  SentenceTokenizer,
  SentimentAnalyzer,
} = require('natural')

const ruleSet = new RuleSet(LANG)
const lexicon = new Lexicon(LANG, DEFAULT_CAT, DEFAULT_CAT_CAP)

const analyze = text => {
  log('analyze', 'Analyzing text', text)

  log('tokenize', 'Tokenizing sentences')
  let sentences = text
    .split(/\r|\n|\r\n/g)
    .map(x => x.trim())
    .filter(Boolean)

  // sentences = new SentenceTokenizer().tokenize(text)
  const analysis = sentences.map(sentence => {
    log('sentiment', 'Detecting sentiment')
    const words = new WordTokenizer().tokenize(sentence)

    const sentiment = new SentimentAnalyzer(
      'English',
      PorterStemmer,
      'afinn'
    ).getSentiment(words)

    log('classify', 'Classifying parts of speech')
    const tagger = new BrillPOSTagger(lexicon, ruleSet)
    const { taggedWords } = tagger.tag(words)

    const nouns = taggedWords
      .filter(({ tag }) => /^N/.test(tag))
      .map(({ token }) => token)

    log('extract', 'Extracting keywords')
    const keywords = PorterStemmer.tokenizeAndStem(sentence)

    return { sentence, words, keywords, nouns, sentiment }
  })

  log('analyze', 'Analysis complete', analysis)
  return analysis
}

module.exports = { analyze }
