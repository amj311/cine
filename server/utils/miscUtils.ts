export function encodeMediaPath(path: string) {
	return encodeURIComponent(path.split('&').join('<amp>'));
}

export function decodeMediaPath(path: string) {
	// decode first so that '<' are preserved
	return decodeURIComponent(path).split('<amp>').join('&');
}


export function safeParseInt(input: any): number | undefined {
	const parsed = parseInt(input);
	return isNaN(parsed) ? undefined : parsed;
}



export function objectOrder<T, A>(list: Array<T>, getComp: (item: T) => A) {
	return list.sort((a, b) => (getComp(a) < getComp(b)) ? -1 : (getComp(b) < getComp(a) ? 2 : 0));
}