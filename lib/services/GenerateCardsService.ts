import { CardSuites } from '../constants.js';
import Card from '../entities/Card.js'
import UniqueIdManager from './UniqueIdManager.js';
import WordListService from './WordListService.js'

const cardIds = new UniqueIdManager(10);

export default class GenerateCardsService {
	constructor() { }

	/**
	 *
	 * @param numCards
	 * @param teams an array of teams
	 * @returns An array of cards
	 */
	generateCards(teams, config, customWords?) {
		let openCardIdxs = [] as number[];
		const usedWordIdxs = [] as number[];
		const cards = [] as Card[];
		const teamsArray = Array.from(Object.values(teams));

		const numBystanders = (config.numCardsSqrt ** 2) - (teamsArray.length * config.numTeamCards) - config.numAssassins;

		const suitesToFill = [
			...teamsArray.map(team => ({
				...CardSuites[team.id],
				qty: config.numTeamCards,
			})),
			{
				...CardSuites.bystander,
				qty: numBystanders,
			},
			{
				...CardSuites.assassin,
				qty: config.numAssassins,
			},
		];

		const numCards = suitesToFill.reduce((total, suite) => total + suite.qty, 0)

		const wordSet = this.getWordListService().getWordList(config.wordDeck, customWords);
		if (wordSet.length < numCards) {
			return [];
		}

		for (let i = 0; i < numCards; i++) openCardIdxs.push(i)

		do {
			const randIdx = openCardIdxs[Math.floor(Math.random() * openCardIdxs.length)];
			if (openCardIdxs.lastIndexOf(randIdx) < 0) continue;
			openCardIdxs = openCardIdxs.filter((idx) => idx != randIdx);

			let wordIdx;
			do {
				wordIdx = Math.floor(Math.random() * wordSet.length);
			} while (usedWordIdxs.lastIndexOf(wordIdx) != -1);
			usedWordIdxs.push(wordIdx);

			// this process determines which team the randIdx belongs to.
			// teamCap serves as a delimiter for a team's range of cards
			let suite;
			let suiteCap = 0;
			let suiteIdx = 0;
			do {
				suite = suitesToFill[suiteIdx];
				suiteCap = Number(suiteCap) + Number(suite.qty);
				suiteIdx++;
			} while (suiteCap <= randIdx);

			const card = new Card(cardIds.getNew(), wordSet[wordIdx], suite);
			cards.push(card);
		} while (openCardIdxs.length > 0);

		return cards;
	}

	getWordListService() {
		return new WordListService()
	}
}
