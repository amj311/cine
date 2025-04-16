const { test, expect, beforeEach } = require('oliver-test');
const Card = require('./Card');
const Team = require('./Team');

let testTeam;
let testCard;

beforeEach(() => {
    testTeam = new Team('TeamOne', 'Blue Team', 'blue', false);
    testCard = new Card(0, 'test', testTeam);
});

test('constructed with team data', () => {
    expect.equal(testCard.color, testTeam.color);
    expect.equal(testCard.suiteId, testTeam.id);
});

test('do reveal', () => {
    expect.false(testCard.revealed);

    let teamId = testCard.revealTeam();

    expect.true(testCard.revealed);
    expect.equal(teamId, testTeam.id);
});
