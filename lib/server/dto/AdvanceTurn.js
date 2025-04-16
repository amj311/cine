export class AdvanceTurnRequest {
    constructor(currentTeam) {
        this.currentTeam = currentTeam;
    }
}

export class AdvanceTurnResponse {
    constructor(currentTeam) {
        this.nextTeam = currentTeam;
    }
}