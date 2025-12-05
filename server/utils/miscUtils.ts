export function encodeMediaPath(path: string) {
	return encodeURIComponent(path.split('&').join('<amp>'));
}

export function decodeMediaPath(path: string) {
	return decodeURIComponent(path.split('<amp>').join('&'));
}