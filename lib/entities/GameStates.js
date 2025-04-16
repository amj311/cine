class GameState {
    constructor(name, props) {
        this.name = name;
        this.isInPlay = props.isInPlay || false; // determines whether or not to show the waiting screen or the playing screen
        this.canStartGame = props.canStartGame || false; // determines whether or not the game can move from waiting to playing
        this.canAddCodeMaster = props.canAddCodeMaster || false; // determines whether or not new codemasters can be added
        this.canRevealCard = props.canRevealCard || false; // whether or not any cards may be flipped
        this.canAdvanceTurn = props.canAdvanceTurn || false; // whether or not the codemaster can end their turn
        this.canEndGame = props.canEndGame || false; // whether or not the game can move from playing to waiting
        this.isGameOver = props.isGameOver || false; // if the game has ended but is still in playing view.
    }
}

export const GameStates = {
    waitingToStart: new GameState('waitingToStart', {
        isInPlay: false,
        canStartGame: true,
        canAddCodeMaster: true,
        canEndGame: false,
    }),

    turnPrep: new GameState('turnPrep', {
        isInPlay: true,
        canRevealCard: false,
        canAdvanceTurn: false,
        canEndGame: true,
    }),

    guessing: new GameState('guessing', {
        isInPlay: true,
        canRevealCard: true,
        canAdvanceTurn: true,
        canEndGame: true,
    }),

    gameOver: new GameState('gameOver', {
        isGameOver: true,
        isInPlay: true,
        canEndGame: true,
    }),

    missingCaptain: new GameState('missingCaptain', {
        isInPlay: true,
        canEndGame: true,
        canAddCodeMaster: true,
    }),
};
