import { PlayableTeamIds } from '../constants';

export function getCaptainsTeam(user, teams) {
	for (let id of PlayableTeamIds) {
		let team = teams[id];
		if (team?.captainId == user?.id) return team;
	}
	return null;
}

const seconds = (n) => n * 1000;
const timeBonus = (time, threshold, bonus) => {
	const thresholdRemaining = threshold - time;
	return Math.max(0, thresholdRemaining / threshold) * bonus;
};

export function computeTurnPoints(turn, cards) {
	const TEAM_CARD_POINTS = 100;
	const HINT_TIME_BONUS_POINTS = 50;
	const HINT_TIME_THRESHOLD = seconds(30);
	const GUESSING_TIME_BONUS_POINTS = 50;
	const GUESSING_TIME_THRESHOLD = seconds(60);

	const hintTime = turn.hintGivenTime ? turn.hintGivenTime - turn.turnStartTime : 0;
	console.log('hint time', turn.turnStartTime, turn.hintGivenTime, hintTime);
	const guessingTime = turn.turnEndTime ? turn.turnEndTime - turn.hintGivenTime : 0;

	const numTeamCards = cards.filter(
		(c) => c.suiteId === turn.teamId && turn.revealedCardIds.includes(c.id)
	).length;
	const comboMultiplier = numTeamCards;

	const breakdown = {
		hintTime,
		guessingTime,
		hintTimeBonus: timeBonus(hintTime, HINT_TIME_THRESHOLD, HINT_TIME_BONUS_POINTS),
		guessingTimeBonus: timeBonus(
			guessingTime,
			GUESSING_TIME_THRESHOLD,
			GUESSING_TIME_BONUS_POINTS
		),
		numTeamCards,
		teamCardPoints: TEAM_CARD_POINTS * numTeamCards,
		comboMultiplier,
	};

	// award 0 points for no team cards
	const subTotal =
		numTeamCards === 0
			? 0
			: breakdown.teamCardPoints + breakdown.hintTimeBonus + breakdown.guessingTimeBonus;
	const total = subTotal * comboMultiplier;

	return {
		...breakdown,
		subTotal,
		total,
	};
}

export function computeGamePoints(game) {
	// Balance here: because the number of cards can vary,
	// Don't allow high scores for completely omitting OR overwhelming one type of card
	const UNFLIPPED_OPPONENT_CARD_POINTS = 50;
	const turns = game.turnHistory;

	const turnBreakdowns = turns.map((turn) => computeTurnPoints(turn, game.cards));
	const totalTurnPoints = turnBreakdowns.reduce((a, b) => a + b.total, 0);

	// assumes there is only one team when playing High Scores
	const teamId = Object.keys(game.teams)[0];
	const opponentCards = !teamId ? [] : game.cards.filter((c) => c.suiteId !== teamId);
	const numOpponentCards = opponentCards.length;
	const unflippedOpponentCards = opponentCards.filter((c) => !c.flipped).length;

	const breakdown = {
		turnBreakdowns,
		totalTurnPoints,
		numOpponentCards,
		unflippedOpponentCards,
		unflippedOpponentCardPoints: UNFLIPPED_OPPONENT_CARD_POINTS * unflippedOpponentCards,
	};

	const total = totalTurnPoints + breakdown.unflippedOpponentCardPoints;

	// stars is not tied to high score. It is just a measurement of completion and accuracy
	const stars =
		turns.length === 0 ? 0 : Math.min(3, Math.floor(game.config.numTeamCards / turns.length));

	return {
		...breakdown,
		total,
		stars,
	};
}
