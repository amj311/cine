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
