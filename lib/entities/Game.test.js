const {test,expect, beforeEach} = require('oliver-test');
const Game = require('./Game');

let game;

beforeEach(()=>{
    game = new Game();
})

test("constructor",()=>{
    expect.notNull(game)
})
