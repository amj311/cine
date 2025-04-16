let wordSet = require('../../words/test_rel.json');
const {test,expect} = require("oliver-test");
const WordListService = require('./WordListService');

test("Get words, no options provided.",()=>{
    let service = new WordListService();
    let wordlist = service.getWordList();
    expect.notNull(wordlist)
    expect.true(wordlist.length > 0)
})