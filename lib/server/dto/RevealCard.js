export class RevealCardRequest {
  constructor(cardId) {
    this.cardId = cardId
  }
}

export class RevealCardResponse {
  constructor(card, wasTeamCard, gameData) {
    this.card = card
    this.wasTeamCard = wasTeamCard
    this.gameData = gameData
  }
}
