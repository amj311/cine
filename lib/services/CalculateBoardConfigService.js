module.exports = class CalculateBoardConfigService {
    constructor() { }

    /**
     * 
     * @param numCards
     * @param numPlayerTeams
     * @param numCardsPerTeam
     * @param numAssassins
     * @returns An array of cards 
     */
    calculateNeutralCards(numCards,numPlayerTeams,numCardsPerTeam,numAssassins) {
        console.assert(numCardsPerTeam <= this.maxPlayerTeamQty(numPlayerTeams,numCards,numAssassins),
            "There are too many player cards!"
        )
        return numCards - numAssassins - numCardsPerTeam*numPlayerTeams;
    }


    maxPlayerTeamQty(numPlayerTeams,numCards,numAssassins) {
        let availableCards = numCards - numAssassins;
        return Math.floor(availableCards / numPlayerTeams);
    }

}