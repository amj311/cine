import { AI_CODEMASTER, CardSuites, DefaultWordDecks } from '../constants.js';
import GameRoom from '../server/GameRoom.js';
import { AiService } from '../services/AiService.js';
import GenerateCardsService from '../services/GenerateCardsService.js'
import Card from './Card.js';
import { GameStates } from './GameStates.js'
import Team from './Team.js'


const defaultConfig = {
	mode: 'classic',
	wordDeck: DefaultWordDecks[0].name,
	numCardsSqrt: 5,
	numTeams: 2,
	numTeamCards: 9,
	numAssassins: 1,
	numBystanders: 6,
};

type Turn = {
	turnCount: number,
	teamId: string,
	hint: string,
	hintExplanation?: string,
	matchingCardIds: string[],
	revealedCardIds: string[],
	turnStartTime: number,
	hintGivenTime?: number,
	turnEndTime?: number
}

export default class Game {
	public room!: GameRoom;
	public config = defaultConfig;
	public state = GameStates.waitingToStart;
	public teams!: Record<string, Team>;
	public cards: Card[] = [];

	public turnHistory: Turn[] = [];
	public currentTurn: Turn | null = null;
	public turnCount = 0;
	public winner: Team | null = null;
	public winningCard: Card | null = null;

	public aiHintFailure = false;

	private usingCustomWords = '';
	private aiHintCount = 0;

	constructor(room: GameRoom) {
		this.room = room;
		this.configure();
	}

	public getSummary() {
		return {
			config: this.config,
			state: this.state,
			teams: this.teams,
			cards: this.cards,
			teamOfTurn: this.teamOfTurn,
			winner: this.winner,
			winningCard: this.winningCard,
			turnCount: this.turnCount,
			aiHintFailure: this.aiHintFailure,
			currentTurn: this.currentTurn,
			turnHistory: this.turnHistory
		}
	}

	private configure(config = null) {
		this.config = this.sanitizeConfig(config || defaultConfig);
		this.configureTeams();
	}

	private sanitizeConfig(config) {
		config.numCardsSqrt = parseInt(config.numCardsSqrt)
		config.numTeams = parseInt(config.numTeams)
		config.numTeamCards = parseInt(config.numTeamCards)
		config.numAssassins = parseInt(config.numAssassins)
		config.numBystanders = parseInt(config.numBystanders)
		return config;
	}

	private configureTeams() {
		if (!this.teams) {
			this.teams = {
				teamOne: new Team('teamOne', 'Blue', '#0bf'),
			}
		}
		if (this.config.mode === 'high score') {
			if (!this.teams.teamOne.captainId) {
				this.teams.teamOne.captainId = this.teams.teamTwo?.captainId;
			}
			delete this.teams.teamTwo;
			this.config.numTeams = 1;
			// set all players to team one
			this.room.users.forEach(user => {
				user.teamId = 'teamOne';
			})
		}
		else if (!this.teams.teamTwo) {
			this.teams.teamTwo = new Team('teamTwo', 'Red', '#f22');
			this.config.numTeams = 2;
		}
	}

	get teamOfTurn() {
		return this.teams[this.currentTurn?.teamId || ''];
	}

	public get actions() {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const game = this;
		return {
			configure({ config, customWords }) {
				game.configure(config);
				game.usingCustomWords = customWords;
			},

			makeUserCaptain({ teamCode, userId }) {
				game.teams[teamCode].captainId = userId;
			},
			removeTeamCaptain({ teamCode }) {
				game.teams[teamCode].captainId = null;
			},

			startGame() {
				if (!game.state.canStartGame) {
					console.log('Cannot start game from this state!')
					return
				}
				game.configureTeams();
				game.cards = new GenerateCardsService().generateCards(
					game.teams,
					game.config,
					game.usingCustomWords
				);
				let firstTeamId = game.teams.teamOne.id;
				if (game.config.numTeams > 1) {
					firstTeamId = Math.random() > (1 / game.config.numTeams) ? game.teams.teamTwo.id : game.teams.teamOne.id;
				}

				game.advanceTurn(firstTeamId);

				// notify all players
				game.room.gameInterface.notifyAll({ title: `Game ${game.room.id} has started!` });
			},

			// endGame() {
			// 	if (!game.state.canEndGame) return;
			// 	game.state = GameStates.gameOver;
			// },

			exitGame() {
				if (!game.state.canEndGame) return;
				game.actions.resetGame();
			},

			startGuessing({ hint, matchingCardIds, hintExplanation }) {
				if (!game.currentTurn) return;

				game.state = GameStates.guessing;

				game.currentTurn.hint = hint;
				game.currentTurn.matchingCardIds = matchingCardIds;
				game.currentTurn.hintExplanation = hintExplanation;
				game.currentTurn.hintGivenTime = Date.now();

				// notify players other than the current captain
				const users = Array.from(game.room.users.values()).filter(user => user.id !== game.teamOfTurn.captainId);
				game.room.gameInterface.notifyBatch(users.map(({ id }) => ({ userId: id, notification: { title: 'The next hint is ready!' } })));
			},

			revealCard({ cardId }) {
				game.revealCard(cardId);
			},

			retryAiHint() {
				game.attemptAiHint();
			},

			async advanceTurn() {
				game.advanceTurn();
			},

			resetGame() {
				game.cards = [];
				game.winner = null;
				game.winningCard = null;
				game.turnCount = 0;
				game.aiHintFailure = false;
				game.aiHintCount = 0;
				game.currentTurn = null;
				game.turnHistory = [];
				game.state = GameStates.waitingToStart;
			}
		}
	}

	revealCard(cardId) {
		if (!this.state.canRevealCard) return;
		const card = this.getCardById(cardId);

		const cardTeam = this.getCardTeam(card);
		const cardSuite = CardSuites[card.suiteId];
		const cardBelongsToTeamOfTurn = cardSuite.id === this.teamOfTurn!.id;

		card.revealed = true;
		this.currentTurn!.revealedCardIds.push(cardId);

		// other team wins if assassin!
		if (cardSuite.id === 'assassin') {
			let winner;
			if (this.config.mode === 'classic') {
				winner = this.teamOfTurn!.id === this.teams.teamOne.id ? this.teams.teamTwo : this.teams.teamOne;
			}
			this.setEndGame(card, winner);
		}

		// bystander ends turn
		else if (cardSuite.id === 'bystander') {
			this.advanceTurn();
		}

		else if (cardTeam) {
			const remainingCards = this.cards.filter((c) => c.suiteId === cardTeam.id && !c.revealed).length;
			// card team wins if they have no more cards
			if (remainingCards === 0) {
				this.setEndGame(card, cardTeam);
			}

			// next turn
			else if (!cardBelongsToTeamOfTurn || this.currentTurn!.revealedCardIds.length > this.currentTurn!.matchingCardIds.length) {
				this.advanceTurn();
			}
		}
	}

	async advanceTurn(teamId?: string) {
		let nextTeamId = teamId || this.teams.teamOne.id;
		if (!teamId && this.config.mode === 'classic') {
			nextTeamId = this.teamOfTurn!.id === this.teams.teamOne.id ? this.teams.teamTwo.id : this.teams.teamOne.id;
		}

		if (this.currentTurn) {
			this.currentTurn.turnEndTime = Date.now();
		}
		const previousHint = this.currentTurn?.hint;

		this.currentTurn = {
			teamId: nextTeamId,
			turnCount: this.turnCount,
			hint: '',
			hintExplanation: '',
			matchingCardIds: [],
			revealedCardIds: [],
			turnStartTime: Date.now(),
		};
		this.turnHistory.push(this.currentTurn);
		this.turnCount++;
		this.state = GameStates.turnPrep;

		if (this.teamOfTurn.captainId === AI_CODEMASTER) {
			// allow this to complete asynchronously
			this.attemptAiHint(previousHint);
		}
		else {
			// alert captain to give hint
			const captainId = this.teamOfTurn.captainId;
			await this.room.gameInterface.notifyUser(captainId, { title: 'Time to give your team a hint!' });
		}

	}

	setEndGame(card, winningTeam) {
		this.currentTurn!.turnEndTime = Date.now();
		this.winner = winningTeam;
		this.winningCard = card;
		this.state = GameStates.gameOver;
		// notify players
		this.room.gameInterface.notifyAll({ title: 'The game is over!', body: 'Come see how it ended' });
	}

	getCardTeam(card) {
		const team = Array.from(Object.values(this.teams)).find((t) => t.id == card.suiteId)
		return team
	}

	getCardById(id): Card {
		return this.cards.find((c) => c.id == id)!
	}

	removePlayer(userId) {
		for (const team of Object.values(this.teams)) {
			if (team.captainId == userId) {
				team.captainId = null
			}
		}
	}

	canContinueAiHint(originalTeamId, originalTurnCount, originaliHintCount) {
		if (this.teamOfTurn?.id !== originalTeamId) return false;
		if (!this.state.isInPlay) return false;
		if (this.teamOfTurn?.captainId !== AI_CODEMASTER) return false;
		if (this.turnCount !== originalTurnCount) return false;
		if (this.aiHintCount !== originaliHintCount) return false;
		return true;
	}

	async attemptAiHint(previousHint?: string) {
		this.aiHintFailure = false;
		this.aiHintCount++;
		const originalTeamId = this.teamOfTurn?.id;
		const originalTurnCount = this.turnCount;
		const originalAiHintCount = this.aiHintCount;
		if (!this.canContinueAiHint(originalTeamId, originalTurnCount, originalAiHintCount)) return;
		try {
			const { success, response: hint } = await this.getHintFromAi(originalTeamId, previousHint);
			if (!this.canContinueAiHint(originalTeamId, originalTurnCount, originalAiHintCount)) return;
			if (!success) {
				this.aiHintFailure = true;
				return;
			};
			const matchingCardIds = hint.matchingWords.map(w => this.cards.find(c => c.word === w)?.id);
			if (matchingCardIds.length === 0) {
				this.aiHintFailure = true;
				return;
			}
			this.actions.startGuessing({ hint: hint.hint, matchingCardIds, hintExplanation: hint.explanation });
		}
		catch (e) {
			console.error("Error getting AI hint");
			console.log(e);
		}
	}

	async getHintFromAi(forTeamId: string, previousHint?: string, cntAttempts = 0) {
		if (!this.teamOfTurn || !this.state.isInPlay) return { success: false, aborted: true };

		const { teamWords, opposingWords } = this.cards.reduce(
			(res, c) => {
				// We only need to consider cards which have not yet been flipped
				// This allows greater flexibility as the game progresses
				if (!c.revealed) {
					if (c.suiteId === forTeamId) {
						res.teamWords.push(c.word);
					}
					else {
						res.opposingWords.push(c.word);
					}
				}
				return res;
			},
			{ teamWords: [] as string[], opposingWords: [] as string[] },
		);

		const { success, response } = await AiService.getHint(teamWords, opposingWords, previousHint);
		if (!success && cntAttempts < 2) {
			return await this.getHintFromAi(forTeamId, previousHint, cntAttempts + 1);
		};
		return {
			success, response
		};
	}
}
