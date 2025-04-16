module.exports = class GameConfig {
    constructor(props) {
        this.numCardsSqrt = props.numCardsSqrt;
        this.numTeams = props.numTeams;
        this.numTeamCards = props.numTeamCards;
        this.numAssassins = props.numAssassins;
        this.numBystanders = props.numBystanders;
    }
}