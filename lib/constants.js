export const PlayableTeamIds = ['teamOne', 'teamTwo'];
export const PING_INTERVAL = 1000;

export const AI_CODEMASTER = 'AI_CODEMASTER';

export const CardSuites = {
	teamOne: {
		id: 'teamOne',
		color: '#0bf',
		ninja: 'blue',
		isTeam: true,
	},
	teamTwo: {
		id: 'teamTwo',
		color: '#f22',
		ninja: 'red',
		isTeam: true,
	},
	bystander: {
		id: 'bystander',
		color: '#fecb29',
	},
	assassin: {
		id: 'assassin',
		color: '#2c3e50',
	},
};

export const DefaultWordDecks = [
	{
		name: 'Standard',
		file: 'Standard.txt',
	},
	{
		name: 'Kids',
		file: 'Easy.txt',
	},
	{
		name: 'LDS - Easy',
		file: 'LDS_Easy.txt',
	},
	{
		name: 'Software Development',
		file: 'Software_Development.txt',
	},
];
