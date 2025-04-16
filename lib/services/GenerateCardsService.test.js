const { test, expect, mock, beforeEach, when } = require('oliver-test');
const Team = require('../entities/Team');
const GenerateCardsService = require('./GenerateCardsService');
const WordListService = require('./WordListService');

let service;
let mockWordService;

function verifyTeamCardQty(cards, teams) {
    teams.forEach((t) => {
        let teamCards = cards.filter((c) => c.suiteId === t.id);
        expect.equal(teamCards.length, t.qty);
    });
}

beforeEach(() => {
    service = new GenerateCardsService();
    mockWordService = mock(WordListService);
    when(service, 'getWordListService').thenReturn(mockWordService);
});

test('Error: not enough words', () => {
    let words = ['one', 'two', 'three', 'four'];
    let teams = [new Team('testTeam', 'testTeam', 'blue', 'false', 25)];
    mockWordService.when('getWordList').thenReturn(words);

    expect.throwsError(() => service.generateCards(teams));
});

test('1 team, 4 cards', () => {
    let words = ['one', 'two', 'three', 'four'];
    let teams = [new Team('testTeam', 'testTeam', 'blue', 'false', 4)];
    mockWordService.when('getWordList').thenReturn(words);

    let cards = service.generateCards(teams);
    expect.notNull(cards);
    expect.equal(cards.length, 4);
    verifyTeamCardQty(cards, teams);
});

test('2 teams, 4 cards', () => {
    let words = ['one', 'two', 'three', 'four'];
    let teams = [
        new Team('testTeam', 'testTeam', 'blue', false, 2),
        new Team('testTeam2', 'testTeam2', 'blue', false, 2),
    ];
    mockWordService.when('getWordList').thenReturn(words);

    let cards = service.generateCards(teams);
    expect.notNull(cards);
    expect.equal(cards.length, 4);
    verifyTeamCardQty(cards, teams);
});

test('4 teams, 25 cards', () => {
    let words = 'word,'.repeat(25).split(',');
    let teams = [
        new Team('testTeam', 'testTeam', 'blue', false, 9),
        new Team('testTeam2', 'testTeam2', 'blue', false, 9),
        new Team('testTeam3', 'bystander', 'blue', false, 6),
        new Team('testTeam4', 'assassin', 'blue', false, 1),
    ];
    mockWordService.when('getWordList').thenReturn(words);

    let cards = service.generateCards(teams);
    expect.notNull(cards);
    expect.equal(cards.length, 25);
    verifyTeamCardQty(cards, teams);
});
