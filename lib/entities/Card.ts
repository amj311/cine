export default class Card {
	id: string
	word: string
	suiteId: string
	color: string
	revealed: boolean

	constructor(id: string, word: string, suite) {
		this.id = id
		this.word = word
		this.suiteId = suite.id
		this.color = suite.color
		this.revealed = false
	}
}
