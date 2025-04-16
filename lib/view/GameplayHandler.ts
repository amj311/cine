export default interface GameplayHandler {
    startGame(payload:any):any;
    advanceTurn(payload:any):any;
    revealCard(payload:any):any;
    gameWon(payload:any):any;
}