/** MediaEl currentTime 1.23456 -> 1234 */
export function secToMs(seconds: number) {
	return Math.round(seconds * 1000);
}

/** 1234 -> MediaEl currentTime 1.234 */
export function msToSec(ms: number) {
	return Number((ms / 1000).toFixed(3));
}

type TimeParts = {
	d?: number,
	h?: number,
	m?: number,
	s?: number,
	ms?: number,
}

const MS_IN_S = 1000;
const MS_IN_M = MS_IN_S * 60;
const MS_IN_H = MS_IN_M * 60;
const MS_IN_D = MS_IN_H * 24;

export function msToTimeParts(ms: number): TimeParts {
	let remaining = ms;
	const d = Math.floor(remaining / MS_IN_D);
	const daysInMs = d * MS_IN_D;
	remaining -= daysInMs;
	const h = Math.floor(remaining / MS_IN_H);
	const hoursInMs = h * MS_IN_H;
	remaining -= hoursInMs;
	const m = Math.floor(remaining / MS_IN_M);
	const minutesInMs = m * MS_IN_M;
	remaining -= minutesInMs;
	const s = Math.floor(remaining / MS_IN_S);
	const secondsInMs = s * MS_IN_S;
	remaining -= secondsInMs;

	return {
		d,
		h,
		m,
		s,
		ms: remaining,
	}
}

export function msToTimestamp(mil: number, hideHour = false, hideMs = true) {
	const { h, m, s, ms } = msToTimeParts(mil);
	return `${hideHour ? '' : String(h).padStart(1, '0') + ':'}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${(ms && !hideMs) ? '.' + String(ms).padStart(3, '0') : ''}`
}

export function timePartsToMs({ h, m, s, ms }: TimeParts) {
	return ((h || 0) * MS_IN_H) + ((m || 0) * MS_IN_M) + ((s || 0) * MS_IN_S) + (ms || 0);
}

export function episodeTag({ seasonNumber, episodeNumber }) {
	return `S${seasonNumber}:E${String(episodeNumber).padStart(2, '0')}`
}








export function encodeMediaPath(path: string) {
	return encodeURIComponent(path.split('&').join('<amp>'));
}

export function decodeMediaPath(path: string) {
	return decodeURIComponent(path).split('<amp>').join('&');
}