export function randomString(length) {
	let string = '';
	while (string.length < length) {
		let char;
		do {
			char = String.fromCharCode(97 + Math.floor(Math.random() * 26));
		} while ('aeiou'.lastIndexOf(char) >= 0);
		string += char;
	}
	return string;
}

class UniqueIdManager {
	constructor(length) {
		this.idLength = length;
		this.ids = new Set();
	}

	getNew() {
		let newId;
		do {
			newId = randomString(this.idLength).toUpperCase();
		} while (this.ids.has(newId));
		this.ids.add(newId);
		return newId;
	}

	remove(id) {
		this.ids.delete(id);
	}
}

export default UniqueIdManager;
